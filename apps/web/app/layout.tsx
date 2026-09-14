import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/layout/pwa";
import { ToastProvider } from "@/components/ui/overlay";
import { normalizeTemplate, TEMPLATE_COOKIE } from "@/lib/templates";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OSES-J", template: "%s · OSES-J" },
  description: "AI-powered social export sales system: find buyers on Instagram and Facebook, organize them, and sell with an AI sales agent.",
  applicationName: "OSES-J",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "OSES-J", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem("oses-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The workspace template is mirrored into a cookie when saved, so the first paint already has it (no flash).
  const store = await cookies();
  const template = normalizeTemplate(store.get(TEMPLATE_COOKIE)?.value);
  return (
    <html lang="en" suppressHydrationWarning data-template={template} className={fontVariables}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-app text-body">
        <ToastProvider>{children}</ToastProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
