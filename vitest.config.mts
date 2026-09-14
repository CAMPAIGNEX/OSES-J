import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Two projects:
 *  - unit:        pure logic across packages, no database
 *  - integration: real MySQL (TEST_DATABASE_URL) covering the MVP workflow and failure cases
 */
export default defineConfig({
  resolve: {
    alias: { "server-only": path.resolve(import.meta.dirname, "tests/src/support/server-only.ts") },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["packages/**/*.test.ts", "tests/src/unit/**/*.test.ts"], environment: "node", setupFiles: ["tests/src/support/env.ts"] },
      },
      {
        extends: true,
        test: { name: "integration", include: ["tests/src/integration/**/*.test.ts"], environment: "node", setupFiles: ["tests/src/support/env.ts"], globalSetup: ["tests/src/support/global-setup.ts"], testTimeout: 60_000, hookTimeout: 120_000, fileParallelism: false },
      },
    ],
  },
});
