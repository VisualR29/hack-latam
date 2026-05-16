import {
  ALLOWED_EXTENSIONS,
  IGNORE_PATH_PREFIXES,
  MAX_FILES,
  MAX_TOTAL_CONTENT_BYTES,
} from "../constants.js";
import type { FileSnapshot } from "./types.js";

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\.(?=\/|\\)/g, "");
}

export function shouldIncludePath(relPath: string): boolean {
  const n = normalizeRelPath(relPath);
  for (const pre of IGNORE_PATH_PREFIXES) {
    if (n.startsWith(pre) || n.includes("/" + pre)) return false;
  }
  const lower = n.toLowerCase();
  const base = lower.includes("/") ? lower.slice(lower.lastIndexOf("/") + 1) : lower;
  if (base === ".env" || base.startsWith(".env.")) return true;

  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  return true;
}

export function applyGlobalLimits(
  files: FileSnapshot[],
  existingWarnings: string[],
): { files: FileSnapshot[]; warnings: string[]; truncated: boolean } {
  const warnings = [...existingWarnings];
  let truncated = false;
  let total = 0;
  const out: FileSnapshot[] = [];

  for (const f of files) {
    if (out.length >= MAX_FILES) {
      truncated = true;
      warnings.push(
        `Se alcanzó el límite de ${MAX_FILES} archivos; el resto no se analizó.`,
      );
      break;
    }
    const next = total + f.content.length;
    if (next > MAX_TOTAL_CONTENT_BYTES) {
      truncated = true;
      warnings.push(
        `Se alcanzó el límite de ~${Math.round(MAX_TOTAL_CONTENT_BYTES / 1024)} KB de texto analizable; parte del proyecto se omitió.`,
      );
      break;
    }
    total = next;
    out.push(f);
  }

  return { files: out, warnings, truncated };
}
