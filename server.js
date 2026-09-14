/**
 * Production entry file for hosts that start Node apps with `node server.js`
 * (framework preset "Other"). It applies pending database migrations with a pure-JS runner
 * (shared hosts cannot execute Prisma's engine binary), then serves the Next.js app in-process
 * on $PORT. Running Next in-process (no child process) means a host restart frees the port.
 */
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = __dirname;
const webDir = path.join(root, "apps", "web");
const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || "0.0.0.0";

// Startup diagnostics for hosting logs (names only, never secret values).
const present = ["NODE_ENV", "APP_URL", "DATABASE_URL", "AUTH_SECRET", "ENCRYPTION_KEY", "JOB_RUNNER_MODE"].filter((k) => process.env[k]);
console.log(`[server] node ${process.version} | port ${port} | cwd ${root} | env set: ${present.join(", ") || "none"}`);

async function runMigrations() {
  // A failure is logged but does not block the app: /api/health reports the database state.
  if (!process.env.DATABASE_URL) {
    console.error("[server] DATABASE_URL is not set; skipping migrations");
    return;
  }
  try {
    const { migrateDeploy } = await import(pathToFileURL(path.join(root, "packages", "database", "scripts", "migrate.mjs")).href);
    const summary = await migrateDeploy({ log: console });
    console.log(`[server] migrations: applied ${summary.applied.length} (${summary.applied.join(", ") || "-"}), already applied ${summary.skipped}`);
  } catch (err) {
    console.error(`[server] migrations failed: ${err && err.message ? err.message : err}; starting the app anyway`);
  }
}

function listen(server, attempt = 1) {
  server.once("error", (err) => {
    if (err && err.code === "EADDRINUSE" && attempt <= 12) {
      // A previous instance may still be shutting down after a host restart; wait and retry.
      console.error(`[server] port ${port} is busy (attempt ${attempt}/12); retrying in 5s`);
      setTimeout(() => listen(server, attempt + 1), 5000);
      return;
    }
    console.error("[server] failed to start:", err);
    process.exit(1);
  });
  server.listen(port, hostname, () => console.log(`[server] ready on http://${hostname}:${port}`));
}

async function main() {
  await runMigrations();
  process.chdir(webDir);
  const next = require(require.resolve("next", { paths: [webDir] }));
  const app = next({ dev: false, dir: webDir, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("[server] request failed:", err && err.message ? err.message : err);
      if (!res.headersSent) res.statusCode = 500;
      res.end("Internal Server Error");
    });
  });
  server.keepAliveTimeout = 65_000;
  listen(server);
  const shutdown = (signal) => {
    console.log(`[server] ${signal} received; shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => shutdown(signal));
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
