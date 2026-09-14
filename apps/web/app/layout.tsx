import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/overlay";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OSES J", template: "%s · OSES J" },
  description: "AI-powered social export sales system",
};

const themeScript = `(function(){try{var t=localStorage.getItem("oses-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-app text-body">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
