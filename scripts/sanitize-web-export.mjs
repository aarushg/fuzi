import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "expo-app", "dist");

async function sanitizeHtml(filePath) {
  const original = await fs.readFile(filePath, "utf8");
  const sanitized = original
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  if (sanitized !== original) await fs.writeFile(filePath, sanitized);
}

async function sanitizeJavaScript(filePath) {
  const original = await fs.readFile(filePath, "utf8");
  const sanitized = original
    .replace(/https?:\/\/127\.0\.0\.1:5000/g, "")
    .replace(/https?:\/\/localhost:5000/g, "")
    .replace(/non-minified dev environment/g, "production diagnostics")
    .replace(/use the production diagnostics for the full error message and additional helpful warnings\./g, "an error occurred.")
    .replace(/; visit ([^"]+) or use the production diagnostics for full errors and additional helpful warnings\./g, ".")
    .replace(/\\"bundler\\":\\"metro\\",/g, "")
    .replace(/\\"output\\":\\"single\\",/g, "");
  if (sanitized !== original) await fs.writeFile(filePath, sanitized);
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (entry.isFile() && /\.html?$/i.test(entry.name)) return sanitizeHtml(fullPath);
    if (entry.isFile() && /\.js$/i.test(entry.name)) return sanitizeJavaScript(fullPath);
  }));
}

await walk(distDir);
await fs.rm(path.join(distDir, "metadata.json"), { force: true });
