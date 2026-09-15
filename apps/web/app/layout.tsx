import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/layout/pwa";
import { ToastProvider } from "@/components/ui/overlay";
import { normalizeTemplate, TEMPLATE_COOKIE } from "@/lib/templates";
import { normalizeTheme, THEME_COOKIE } from "@/lib/theme";
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The workspace template is mirrored into a cookie when saved, so the first paint already has it (no flash).
  const store = await cookies();
  const template = normalizeTemplate(store.get(TEMPLATE_COOKIE)?.value);
  // Same for light/dark: the device preference is mirrored into a cookie so the first byte already carries it.
  const theme = normalizeTheme(store.get(THEME_COOKIE)?.value);
  return (
    <html lang="en" suppressHydrationWarning data-template={template} className={theme === "dark" ? `${fontVariables} dark` : fontVariables}>
      <head>
        {/* Fallback for visitors without the theme cookie (system preference). `async src` is the one form of <script>
            React treats as a hoistable resource, so it never warns when the layout is re-rendered on the client. */}
        <script async src="/theme-init.js" />
      </head>
      <body className="min-h-screen bg-app text-body">
        <ToastProvider>{children}</ToastProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
