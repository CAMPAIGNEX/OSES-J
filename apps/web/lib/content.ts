import "server-only";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

/**
 * Public website content. Docs live as markdown files in apps/web/content/docs so the manual
 * evolves with the product: add or edit a file and the site updates on the next deploy.
 */
const contentRoot = path.join(process.cwd(), "content");

export interface DocMeta {
  slug: string;
  title: string;
  section: string;
  order: number;
  summary: string;
  updatedAt: string;
}

export interface DocPage extends DocMeta {
  html: string;
  headings: Array<{ id: string; text: string; level: number }>;
}

export const DOC_SECTIONS = ["Getting started", "Finding leads", "Clients & CRM", "Messaging", "AI assistant", "Automation", "Analysis", "Integrations", "Administration", "Help"] as const;

function docsDir(): string {
  return path.join(contentRoot, "docs");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function readMeta(file: string): DocMeta {
  const full = path.join(docsDir(), file);
  const { data } = matter(readFileSync(full, "utf8"));
  const stat = statSync(full);
  return {
    slug: file.replace(/\.md$/, ""),
    title: String(data.title ?? file),
    section: String(data.section ?? "Help"),
    order: Number(data.order ?? 100),
    summary: String(data.summary ?? ""),
    updatedAt: (data.updated ? new Date(String(data.updated)) : stat.mtime).toISOString(),
  };
}

export function listDocs(): DocMeta[] {
  const files = readdirSync(docsDir()).filter((f) => f.endsWith(".md"));
  const sectionIndex = (s: string) => {
    const i = DOC_SECTIONS.indexOf(s as (typeof DOC_SECTIONS)[number]);
    return i === -1 ? 99 : i;
  };
  return files.map(readMeta).sort((a, b) => sectionIndex(a.section) - sectionIndex(b.section) || a.order - b.order || a.title.localeCompare(b.title));
}

export function getDoc(slug: string): DocPage | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = path.join(docsDir(), `${slug}.md`);
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  const headings: DocPage["headings"] = [];
  const renderer = new marked.Renderer();
  renderer.heading = ({ text, depth }) => {
    const id = slugify(text);
    if (depth === 2 || depth === 3) headings.push({ id, text, level: depth });
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  const html = marked.parse(content, { renderer, gfm: true, breaks: false }) as string;
  const stat = statSync(file);
  return {
    slug,
    title: String(data.title ?? slug),
    section: String(data.section ?? "Help"),
    order: Number(data.order ?? 100),
    summary: String(data.summary ?? ""),
    updatedAt: (data.updated ? new Date(String(data.updated)) : stat.mtime).toISOString(),
    html,
    headings,
  };
}

export function renderMarkdownFile(relativePath: string): { html: string; data: Record<string, unknown>; updatedAt: string } {
  const file = path.join(contentRoot, relativePath);
  const raw = readFileSync(file, "utf8");
  const { data, content } = matter(raw);
  const stat = statSync(file);
  return { html: marked.parse(content, { gfm: true }) as string, data, updatedAt: (data.updated ? new Date(String(data.updated)) : stat.mtime).toISOString() };
}
