import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

await Promise.all([
  fs.rm(path.join(rootDir, "expo-app", "dist"), { recursive: true, force: true }),
  fs.rm(path.join(rootDir, "expo-app", ".expo"), { recursive: true, force: true })
]);
