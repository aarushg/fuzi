import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "expo-app", "dist");
const measuredExtensions = new Set([".css", ".html", ".js"]);
const warningBytes = 300 * 1024;

function formatBytes(bytes) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function fileSize(filePath) {
  try {
    return (await fs.stat(filePath)).size;
  } catch {
    return 0;
  }
}

async function walk(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath, files);
    if (entry.isFile() && measuredExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }));
  return files;
}

const files = await walk(distDir);
const rows = await Promise.all(files.map(async (filePath) => {
  const raw = await fileSize(filePath);
  return {
    file: path.relative(distDir, filePath).replace(/\\/g, "/"),
    raw,
    br: await fileSize(`${filePath}.br`),
    gzip: await fileSize(`${filePath}.gz`)
  };
}));

rows.sort((a, b) => b.raw - a.raw);

console.log("Production web bundle sizes:");
for (const row of rows.slice(0, 20)) {
  const marker = row.raw > warningBytes && path.extname(row.file) === ".js" ? "  WARN >300KB" : "";
  console.log(`${row.file.padEnd(68)} raw ${formatBytes(row.raw).padStart(9)}  br ${formatBytes(row.br).padStart(9)}  gzip ${formatBytes(row.gzip).padStart(9)}${marker}`);
}

const oversizedJs = rows.filter((row) => path.extname(row.file) === ".js" && row.raw > warningBytes);
if (oversizedJs.length) {
  console.warn(`\n${oversizedJs.length} JS bundle(s) exceed 300 KB raw. Consider route-level code splitting for the portal bundle next.`);
}
