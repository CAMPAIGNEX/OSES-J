import path from "node:path";
import { config as loadDotenv } from "dotenv";
import type { NextConfig } from "next";

// The single .env lives at the repository root (shared with workers and Prisma).
loadDotenv({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  transpilePackages: ["@oses/shared", "@oses/validation", "@oses/database", "@oses/apify", "@oses/discovery", "@oses/enrichment", "@oses/messaging", "@oses/ai", "@oses/automation", "@oses/crm"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-mariadb", "mariadb", "exceljs", "@anthropic-ai/sdk"],
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
