import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "expo-app", "dist");
const compressibleExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".txt", ".xml"]);
const minimumBytes = 1024;

const brotliOptions = {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11
  }
};
const gzipOptions = { level: 9 };

async function writeIfSmaller(sourcePath, targetPath, buffer, sourceLength) {
  if (buffer.length >= sourceLength) {
    await fs.rm(targetPath, { force: true });
    return;
  }
  await fs.writeFile(targetPath, buffer);
}

async function compressFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (!compressibleExtensions.has(extension)) return;
  const source = await fs.readFile(filePath);
  if (source.length < minimumBytes) return;
  const [brotli, gzip] = await Promise.all([
    new Promise((resolve, reject) => zlib.brotliCompress(source, brotliOptions, (error, result) => error ? reject(error) : resolve(result))),
    new Promise((resolve, reject) => zlib.gzip(source, gzipOptions, (error, result) => error ? reject(error) : resolve(result)))
  ]);
  await Promise.all([
    writeIfSmaller(filePath, `${filePath}.br`, brotli, source.length),
    writeIfSmaller(filePath, `${filePath}.gz`, gzip, source.length)
  ]);
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (entry.isFile() && !/\.(?:br|gz)$/i.test(entry.name)) return compressFile(fullPath);
  }));
}

await walk(distDir);
