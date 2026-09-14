import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = { title: "Offline" };

/** Served by the service worker when the network is unavailable. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Image src="/brand/oses-j-wordmark.svg" alt="OSES-J" width={150} height={20} className="h-5 w-auto dark:brightness-0 dark:invert" />
      <h1 className="mt-8 text-xl font-semibold">You are offline</h1>
      <p className="mt-2 max-w-sm text-[14px] text-muted">OSES-J needs a connection to load your leads and conversations. Reconnect and pull down to refresh.</p>
    </div>
  );
}
