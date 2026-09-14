/**
 * Builds the MV3 extension into dist/ with esbuild (background worker, content scripts, popup).
 * Usage: pnpm --filter @oses/extension build   (or `watch`)
 */
import { build, context, type BuildOptions } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");

const common: BuildOptions = {
  bundle: true,
  target: "chrome116",
  format: "esm",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  logLevel: "info",
  define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
};

const entries: BuildOptions[] = [
  { ...common, entryPoints: [path.join(root, "src/background/index.ts")], outfile: path.join(dist, "background.js") },
  { ...common, format: "iife", entryPoints: [path.join(root, "src/content/instagram.ts")], outfile: path.join(dist, "content-instagram.js") },
  { ...common, format: "iife", entryPoints: [path.join(root, "src/content/facebook.ts")], outfile: path.join(dist, "content-facebook.js") },
  { ...common, entryPoints: [path.join(root, "src/popup/index.ts")], outfile: path.join(dist, "popup.js") },
];

/** Minimal PNG icons (solid brand-blue squares) so the extension loads without binary assets in git. */
function pngSquare(size: number): Buffer {
  const crcTable = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (buf: Buffer) => {
    let c = -1;
    for (const b of buf) c = (crcTable[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => [0, 127, 255]).flat())]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function run() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(path.join(dist, "icons"), { recursive: true });
  cpSync(path.join(root, "public/manifest.json"), path.join(dist, "manifest.json"));
  cpSync(path.join(root, "src/popup/popup.html"), path.join(dist, "popup.html"));
  for (const size of [16, 48, 128]) {
    const custom = path.join(root, `public/icons/icon${size}.png`);
    if (existsSync(custom)) cpSync(custom, path.join(dist, `icons/icon${size}.png`));
    else writeFileSync(path.join(dist, `icons/icon${size}.png`), pngSquare(size));
  }
  if (watch) {
    const ctxs = await Promise.all(entries.map((e) => context(e)));
    await Promise.all(ctxs.map((c) => c.watch()));
    console.log("watching extension sources…");
  } else {
    await Promise.all(entries.map((e) => build(e)));
    console.log(`extension built to ${dist}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
