import { Prisma, type AIInstruction, type DbClient, type Organization } from "@oses/database";
import { createLogger, estimateTokens, tokenize } from "@oses/shared";
import { resolveEmbeddingProvider } from "./resolve";
import type { EmbeddingProvider } from "./types";

const log = createLogger("ai.knowledge");

/**
 * Knowledge pipeline: Document -> text -> chunks -> (embeddings) -> storage -> retrieval -> prompt.
 *
 * Small knowledge bases work with MySQL full-text search alone. When an embedding provider is
 * configured, chunks also get vectors and retrieval blends both signals.
 */

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? 1200;
  const overlap = Math.min(options.overlapChars ?? 150, Math.floor(maxChars / 3));
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const para of paragraphs) {
    if (para.length > maxChars) {
      push();
      // split long paragraph by sentences
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const s of sentences) {
        if ((current + " " + s).length > maxChars) {
          push();
          if (s.length > maxChars) {
            for (let i = 0; i < s.length; i += maxChars - overlap) chunks.push(s.slice(i, i + maxChars));
            continue;
          }
        }
        current = current ? `${current} ${s}` : s;
      }
      continue;
    }
    if ((current + "\n\n" + para).length > maxChars) {
      const tail = current.slice(-overlap);
      push();
      current = tail && overlap > 0 ? `${tail}\n\n${para}` : para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  push();
  return chunks;
}

export async function ingestKnowledgeText(
  db: DbClient,
  organizationId: string,
  input: { title: string; content: string; documentId?: string | null; sourceType?: "TEXT" | "FILE"; knowledgeDocumentId?: string },
  embeddings: EmbeddingProvider | null = resolveEmbeddingProvider(),
): Promise<{ knowledgeDocumentId: string; chunkCount: number }> {
  const doc = input.knowledgeDocumentId
    ? await db.knowledgeDocument.update({ where: { id: input.knowledgeDocumentId }, data: { status: "PROCESSING", contentText: input.content, charCount: input.content.length, error: null } })
    : await db.knowledgeDocument.create({
        data: { organizationId, title: input.title.slice(0, 200), sourceType: input.sourceType ?? "TEXT", status: "PROCESSING", contentText: input.content, charCount: input.content.length, documentId: input.documentId ?? null },
      });
  try {
    await db.knowledgeChunk.deleteMany({ where: { knowledgeDocumentId: doc.id } });
    const chunks = chunkText(input.content);
    let vectors: number[][] = [];
    if (embeddings && chunks.length) {
      try {
        vectors = await embeddings.embed(chunks);
      } catch (err) {
        log.warn("embedding failed; storing chunks for keyword retrieval only", { error: (err as Error).message });
        vectors = [];
      }
    }
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i]!;
      await db.knowledgeChunk.create({
        data: {
          organizationId,
          knowledgeDocumentId: doc.id,
          chunkIndex: i,
          content,
          tokenEstimate: estimateTokens(content),
          embedding: vectors[i] ? (vectors[i] as unknown as object) : undefined,
          embeddingModel: vectors[i] ? embeddings?.model : null,
        },
      });
    }
    await db.knowledgeDocument.update({ where: { id: doc.id }, data: { status: "READY", chunkCount: chunks.length } });
    return { knowledgeDocumentId: doc.id, chunkCount: chunks.length };
  } catch (err) {
    await db.knowledgeDocument.update({ where: { id: doc.id }, data: { status: "FAILED", error: (err as Error).message.slice(0, 2000) } });
    throw err;
  }
}

export interface RetrievedChunk {
  id: string;
  knowledgeDocumentId: string;
  title: string;
  content: string;
  score: number;
  method: "fulltext" | "embedding" | "keyword";
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    na += (a[i] ?? 0) ** 2;
    nb += (b[i] ?? 0) ** 2;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Retrieve the most relevant knowledge chunks for a query. */
export async function retrieveKnowledge(
  db: DbClient,
  organizationId: string,
  query: string,
  options: { limit?: number; embeddings?: EmbeddingProvider | null } = {},
): Promise<RetrievedChunk[]> {
  const limit = options.limit ?? 6;
  const q = query.trim();
  if (!q) return [];
  const titles = new Map<string, string>();
  const docs = await db.knowledgeDocument.findMany({ where: { organizationId, status: "READY", deletedAt: null }, select: { id: true, title: true } });
  if (!docs.length) return [];
  for (const d of docs) titles.set(d.id, d.title);
  const docIds = docs.map((d) => d.id);
  const results: RetrievedChunk[] = [];

  // 1) embeddings when available (both the query and stored chunks need vectors)
  const embeddings = options.embeddings === undefined ? resolveEmbeddingProvider() : options.embeddings;
  if (embeddings) {
    try {
      const [qv] = await embeddings.embed([q]);
      if (qv) {
        const chunks = await db.knowledgeChunk.findMany({ where: { organizationId, knowledgeDocumentId: { in: docIds }, embedding: { not: Prisma.DbNull } }, select: { id: true, knowledgeDocumentId: true, content: true, embedding: true }, take: 2000 });
        const scored = chunks
          .map((c) => ({ c, score: cosine(qv, (c.embedding as number[]) ?? []) }))
          .filter((x) => x.score > 0.2)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        for (const { c, score } of scored) results.push({ id: c.id, knowledgeDocumentId: c.knowledgeDocumentId, title: titles.get(c.knowledgeDocumentId) ?? "", content: c.content, score, method: "embedding" });
      }
    } catch (err) {
      log.warn("embedding retrieval failed; using full-text", { error: (err as Error).message });
    }
  }
  if (results.length >= limit) return results;

  // 2) MySQL full-text search (natural language mode)
  try {
    const rows = await db.$queryRaw<Array<{ id: string; knowledgeDocumentId: string; content: string; score: number }>>`
      SELECT id, knowledgeDocumentId, content, MATCH(content) AGAINST (${q} IN NATURAL LANGUAGE MODE) AS score
      FROM knowledge_chunks
      WHERE organizationId = ${organizationId} AND MATCH(content) AGAINST (${q} IN NATURAL LANGUAGE MODE) > 0
      ORDER BY score DESC
      LIMIT ${limit}`;
    for (const r of rows) {
      if (results.some((x) => x.id === r.id)) continue;
      if (!titles.has(r.knowledgeDocumentId)) continue;
      results.push({ id: r.id, knowledgeDocumentId: r.knowledgeDocumentId, title: titles.get(r.knowledgeDocumentId) ?? "", content: r.content, score: Number(r.score), method: "fulltext" });
    }
  } catch (err) {
    log.warn("full-text retrieval failed; using keyword LIKE", { error: (err as Error).message });
  }
  if (results.length >= Math.min(limit, 3)) return results.slice(0, limit);

  // 3) keyword LIKE fallback (short queries / stop-word heavy)
  const terms = tokenize(q).filter((t) => t.length >= 4).slice(0, 5);
  if (terms.length) {
    const rows = await db.knowledgeChunk.findMany({
      where: { organizationId, knowledgeDocumentId: { in: docIds }, OR: terms.map((t) => ({ content: { contains: t } })) },
      select: { id: true, knowledgeDocumentId: true, content: true },
      take: limit * 2,
    });
    for (const r of rows) {
      if (results.some((x) => x.id === r.id)) continue;
      const hits = terms.filter((t) => r.content.toLowerCase().includes(t)).length;
      results.push({ id: r.id, knowledgeDocumentId: r.knowledgeDocumentId, title: titles.get(r.knowledgeDocumentId) ?? "", content: r.content, score: hits / terms.length, method: "keyword" });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface CompanyContext {
  organization: Organization;
  instructions: AIInstruction[];
  /** Verified company facts, rendered as a compact block for prompts. */
  factsText: string;
  instructionsText: string;
  prohibitedText: string;
  escalationText: string;
  toneText: string;
}

/** Load the exporter's company facts and AI instructions (the "small knowledge base" stored in MySQL). */
export async function loadCompanyContext(db: DbClient, organizationId: string): Promise<CompanyContext> {
  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const instructions = await db.aIInstruction.findMany({ where: { organizationId, enabled: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const facts: string[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) facts.push(`${label}: ${value.trim()}`);
  };
  add("Company", organization.name);
  add("Description", organization.description);
  add("Website", organization.website);
  add("Location", [organization.city, organization.country].filter(Boolean).join(", "));
  add("Products", organization.products);
  add("MOQ", organization.moq);
  add("Certifications", organization.certifications);
  add("Production capacity", organization.productionCapacity);
  add("Shipping", organization.shippingInfo);
  add("Contact email", organization.contactEmail);
  add("Contact phone", organization.contactPhone);
  const byKind = (kinds: string[]) =>
    instructions
      .filter((i) => kinds.includes(i.kind))
      .map((i) => `## ${i.title}\n${i.content.trim()}`)
      .join("\n\n");
  for (const i of instructions.filter((x) => x.kind === "COMPANY" || x.kind === "PRODUCTS")) facts.push(`${i.title}: ${i.content.trim()}`);
  return {
    organization,
    instructions,
    factsText: facts.join("\n"),
    instructionsText: byKind(["RULES", "CUSTOM", "WORKING_HOURS"]),
    prohibitedText: byKind(["PROHIBITED"]),
    escalationText: byKind(["ESCALATION"]),
    toneText: byKind(["TONE"]),
  };
}
