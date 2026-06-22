import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release");

try {
  await fs.rm(releaseDir, { recursive: true, force: true });
} catch (error) {
  throw new Error(`Failed to clean ${releaseDir}. Close any running FUZI Portal window and retry. ${error.message}`);
}
