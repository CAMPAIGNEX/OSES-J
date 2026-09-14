import { execSync } from "node:child_process";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

/** Apply migrations to the test database once before integration tests run. */
export default function setup(): void {
  loadDotenv({ path: path.resolve(__dirname, "../../../.env") });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.log("TEST_DATABASE_URL not set; integration tests will be skipped");
    return;
  }
  execSync("pnpm exec prisma migrate deploy", { cwd: path.resolve(__dirname, "../../../packages/database"), stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
