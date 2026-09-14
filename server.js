/**
 * Production entry file for hosts that start Node apps with `node server.js`
 * (framework preset "Other"). It applies pending database migrations, then runs `next start`
 * for apps/web on $PORT. Equivalent to `pnpm start`, without needing pnpm at runtime.
 */
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");

const root = __dirname;
const webDir = path.join(root, "apps", "web");
const dbDir = path.join(root, "packages", "database");
const port = process.env.PORT || "3000";

function resolveBin(pkgRelativeFile, from) {
  return require.resolve(pkgRelativeFile, { paths: [from] });
}

// 1) Migrations (idempotent). A failure is logged but does not block the app: /api/health reports DB state.
try {
  const prismaBin = resolveBin("prisma/build/index.js", dbDir);
  const result = spawnSync(process.execPath, [prismaBin, "migrate", "deploy"], { cwd: dbDir, stdio: "inherit", env: process.env });
  if (result.status !== 0) console.error(`[server] prisma migrate deploy exited with ${result.status}; starting the app anyway`);
} catch (err) {
  console.error("[server] could not run migrations:", err && err.message ? err.message : err);
}

// 2) Next.js production server.
const nextBin = resolveBin("next/dist/bin/next", webDir);
const child = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", process.env.HOST || "0.0.0.0"], { cwd: webDir, stdio: "inherit", env: { ...process.env, PORT: String(port) } });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
