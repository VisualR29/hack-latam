import fs from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";
import { shouldIncludePath, applyGlobalLimits } from "./filters.js";
import type { FileSnapshot, IngestOutcome } from "./types.js";

function isSafeExtractPath(extractRoot: string, targetPath: string): boolean {
  const root = path.resolve(extractRoot);
  const resolved = path.resolve(targetPath);
  return resolved === root || resolved.startsWith(root + path.sep);
}

export async function ingestZipFile(
  zipPath: string,
  extractRoot: string,
): Promise<IngestOutcome> {
  const warnings: string[] = [];
  const collected: FileSnapshot[] = [];

  await fs.mkdir(extractRoot, { recursive: true });

  const directory = await unzipper.Open.file(zipPath);

  for (const entry of directory.files) {
    const entryPath = entry.path.replace(/\\/g, "/");
    if (entry.type === "Directory") continue;
    if (!shouldIncludePath(entryPath)) continue;

    const segments = entryPath.split(/[/\\]+/).filter(Boolean);
    if (segments.some((segment: string) => segment === "..")) {
      warnings.push(`Entrada ZIP con segmentos '..': ${entryPath}`);
      continue;
    }

    const dest = path.join(extractRoot, ...segments);
    if (!isSafeExtractPath(extractRoot, dest)) {
      warnings.push(`Entrada ZIP omitida por ruta insegura: ${entryPath}`);
      continue;
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    const buf = await entry.buffer();
    let text: string;
    try {
      text = buf.toString("utf8");
    } catch {
      warnings.push(`No se pudo leer como texto UTF-8: ${entryPath}`);
      continue;
    }
    if (text.includes("\u0000")) {
      warnings.push(`Archivo binario omitido: ${entryPath}`);
      continue;
    }
    collected.push({ path: entryPath, content: text });
  }

  const { files, warnings: w2, truncated } = applyGlobalLimits(
    collected,
    warnings,
  );
  return { files, warnings: w2, truncated };
}
