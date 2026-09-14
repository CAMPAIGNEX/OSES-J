import path from "node:path";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: path.resolve(__dirname, "../../../.env") });
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? "silent";
process.env.JOB_RUNNER_MODE = "worker";
process.env.AI_PROVIDER = "none";
process.env.AI_API_KEY = "";
process.env.APIFY_API_TOKEN = "";
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-auth-secret-0123456789";
process.env.STORAGE_DIR = path.resolve(__dirname, "../../../.test-storage");
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
