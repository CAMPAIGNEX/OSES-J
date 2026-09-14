"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Inbox, Search } from "lucide-react";
import { qs } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { timeAgo } from "@/lib/format";
import { Avatar, Badge, Input, Select, Skeleton, cn } from "@/components/ui/primitives";
import { ConversationView } from "./conversation-view";

interface ConversationRow {
  id: string;
  channel: string;
  status: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  aiStatus: string;
  needsHumanReview: boolean;
  lastIntent: string | null;
  client: { id: string; cid: string; brandName: string; status: string; country: string | null; city: string | null; tags: Array<{ tag: { id: string; name: string } }> };
}
interface ConversationPage {
  items: ConversationRow[];
  total: number;
  page: number;
  totalPages: number;
}

export function InboxView({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [channel, setChannel] = useState(params.get("channel") ?? "");
  const [filter, setFilter] = useState(params.get("aiStatus") ? "ai" : params.get("unread") ? "unread" : "all");
  useEffect(() => {
    const t = setTimeout(() => setApplied(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const query = qs({ q: applied, channel, unread: filter === "unread" ? "true" : "", aiStatus: filter === "ai" ? "suggestion_ready" : "", status: filter === "closed" ? "CLOSED" : "", pageSize: 100 });
  const list = useQuery<ConversationPage>(`/api/conversations${query}`, { refreshInterval: 15_000 });
  const items = (list.data?.items ?? []).filter((c) => (filter === "review" ? c.needsHumanReview : true));

  return (
    <div className="animate-in -mx-4 -my-6 flex h-[calc(100vh-3.5rem)] lg:h-screen sm:-mx-6 lg:-mx-8 lg:-my-6">
      <aside className={cn("flex w-full shrink-0 flex-col border-r border-default bg-surface md:w-[360px]", selectedId && "hidden md:flex")}>
        <div className="border-b border-default p-3">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-base font-semibold">Inbox</h1>
            <span className="text-xs text-faint">{list.data?.total ?? 0} conversations</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients or messages" className="pl-9" />
          </div>
          <div className="mt-2 flex gap-2">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="flex-1">
              <option value="all">All open</option>
              <option value="unread">Unread</option>
              <option value="ai">AI suggestions</option>
              <option value="review">Needs human review</option>
              <option value="closed">Closed</option>
            </Select>
            <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-32">
              <option value="">All channels</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Facebook</option>
            </Select>
          </div>
        </div>
        <ul className="scrollbar-thin flex-1 overflow-y-auto">
          {list.loading && !list.data
            ? Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="border-b border-default p-3"><Skeleton className="h-10" /></li>
              ))
            : items.map((c) => (
                <li key={c.id}>
                  <Link href={`/inbox/${c.id}`} className={cn("flex gap-3 border-b border-default px-3 py-3 transition-colors hover:bg-surface-2/70", selectedId === c.id && "bg-brand-50/70 dark:bg-brand-900/30")}>
                    <Avatar name={c.client.brandName} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("truncate text-[13px]", c.unreadCount > 0 ? "font-semibold" : "font-medium")}>{c.client.brandName}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-faint">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : ""}</span>
                      </div>
                      <p className={cn("truncate text-xs", c.unreadCount > 0 ? "text-body" : "text-muted")}>{c.lastMessagePreview ?? "No messages yet"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge className="font-normal">{c.channel === "INSTAGRAM" ? "IG" : "FB"}</Badge>
                        <span className="font-mono text-[10px] text-faint">{c.client.cid}</span>
                        {c.unreadCount > 0 && <Badge tone="brand">{c.unreadCount}</Badge>}
                        {c.aiStatus === "suggestion_ready" && <Badge tone="purple">AI suggestion</Badge>}
                        {c.needsHumanReview && <Badge tone="warning">Review</Badge>}
                        {c.lastIntent && !c.needsHumanReview && <Badge tone={c.lastIntent === "INTERESTED" ? "success" : "neutral"} className="font-normal">{c.lastIntent.replace(/_/g, " ").toLowerCase()}</Badge>}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
          {!list.loading && items.length === 0 && (
            <li className="p-6 text-center text-[13px] text-muted">
              <Inbox className="mx-auto mb-2 h-5 w-5 text-faint" />
              No conversations match.
            </li>
          )}
        </ul>
      </aside>
      <section className={cn("min-w-0 flex-1", !selectedId && "hidden md:block")}>
        {selectedId ? (
          <ConversationView conversationId={selectedId} onChanged={() => void list.refetch()} onBack={() => router.push("/inbox")} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <Inbox className="mb-3 h-8 w-8 text-faint" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="mt-1 max-w-sm text-[13px] text-muted">Messages from Instagram and Facebook appear here together with AI suggestions and follow-ups.</p>
          </div>
        )}
      </section>
    </div>
  );
}
