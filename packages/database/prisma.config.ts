import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";

// The single `.env` lives at the repository root so every package/app reads the same values.
loadDotenv({ path: path.resolve(import.meta.dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "mysql://root:@127.0.0.1:3306/oses_j_dev",
  },
});
