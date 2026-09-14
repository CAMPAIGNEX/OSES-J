// Plain ESM config (not .ts): the TypeScript config loader needs a recent Node.js and fails on hosts that
// pin an older runtime with "A dynamic import callback was not specified".
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";

// The single .env lives at the repository root (shared with workers and Prisma). Missing file = env from the host.
loadDotenv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

/** @type {import("next").NextConfig} */
const nextConfig = {
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
