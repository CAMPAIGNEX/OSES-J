import { NextResponse } from "next/server";
import { db } from "@oses/database";
import { handleVerification, processMetaWebhook, verifyWebhookSignature, type MetaWebhookPayload } from "@oses/messaging";
import { createLogger, errorMessage, getEnv } from "@oses/shared";
import { enqueueJob } from "@/lib/server/jobs";

const log = createLogger("webhooks.meta");

/** Meta webhook verification handshake. */
export async function GET(req: Request): Promise<Response> {
  const result = handleVerification(new URL(req.url).searchParams);
  if (!result.ok) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(result.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/**
 * Inbound events (messages, delivery, read). The raw body is validated with X-Hub-Signature-256,
 * processed idempotently, and every conversation with a new inbound message gets an AI_REPLY_JOB.
 */
export async function POST(req: Request): Promise<Response> {
  const env = getEnv();
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-hub-signature-256"), env.META_APP_SECRET)) {
    log.warn("rejected webhook with invalid signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }
  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(raw) as MetaWebhookPayload;
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  try {
    const summary = await processMetaWebhook(db, payload);
    for (const conversationId of summary.inboundConversationIds) {
      const conv = await db.conversation.findUnique({ where: { id: conversationId }, select: { organizationId: true } });
      if (conv) await enqueueJob({ type: "AI_REPLY_JOB", organizationId: conv.organizationId, payload: { conversationId }, priority: 2, dedupeKey: `ai-reply:${conversationId}:${Date.now()}`, entityType: "Conversation", entityId: conversationId });
    }
    log.info("webhook processed", { ...summary, inboundConversationIds: undefined });
  } catch (err) {
    // Always acknowledge so Meta does not retry endlessly; failures are logged for investigation.
    log.error("webhook processing failed", { error: errorMessage(err) });
  }
  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
