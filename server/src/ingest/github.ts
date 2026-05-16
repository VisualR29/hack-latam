import {
  MAX_FILES,
  MAX_TOTAL_CONTENT_BYTES,
} from "../constants.js";
import { shouldIncludePath, applyGlobalLimits } from "./filters.js";
import type { FileSnapshot, IngestOutcome } from "./types.js";

const GITHUB_HOST = "github.com";

type ParsedRepo = { owner: string; repo: string };

function parseGithubRepoUrl(input: string): ParsedRepo | null {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.hostname.toLowerCase() !== GITHUB_HOST) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!/^[a-zA-Z0-9_.-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(repo)) {
    return null;
  }
  return { owner, repo };
}

async function ghFetch(
  path: string,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "VibeGuard-MVP",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`https://api.github.com${path}`, { headers });
}

export async function ingestGithubRepo(
  repoUrl: string,
  token?: string,
): Promise<IngestOutcome> {
  const parsed = parseGithubRepoUrl(repoUrl);
  if (!parsed) {
    return {
      files: [],
      warnings: [
        "URL de GitHub no válida. Usa un repositorio público https://github.com/usuario/repo",
      ],
      truncated: false,
    };
  }

  const { owner, repo } = parsed;
  const repoRes = await ghFetch(`/repos/${owner}/${repo}`, token);
  if (!repoRes.ok) {
    const msg =
      repoRes.status === 404
        ? "Repositorio no encontrado o privado (el MVP solo soporta repos públicos sin token adicional)."
        : `GitHub respondió ${repoRes.status} al leer el repositorio.`;
    return { files: [], warnings: [msg], truncated: false };
  }
  const repoJson = (await repoRes.json()) as { default_branch?: string };
  const branch = repoJson.default_branch || "main";

  const treeRes = await ghFetch(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
  );
  if (!treeRes.ok) {
    return {
      files: [],
      warnings: [`No se pudo listar archivos (${treeRes.status}).`],
      truncated: false,
    };
  }

  const treeJson = (await treeRes.json()) as {
    tree?: Array<{ path?: string; type?: string; sha?: string; size?: number }>;
    truncated?: boolean;
  };
  let treeTruncatedRemote = !!treeJson.truncated;

  type TreeBlob = { path: string; sha: string; size?: number };

  const blobs: TreeBlob[] = [];
  for (const entry of treeJson.tree || []) {
    if (
      entry?.type !== "blob" ||
      typeof entry.sha !== "string" ||
      !entry.path ||
      typeof entry.path !== "string"
    )
      continue;
    if (!shouldIncludePath(entry.path)) continue;
    const sizeNum =
      typeof entry.size === "number" ? entry.size : Number(entry.size);
    blobs.push({
      path: entry.path,
      sha: entry.sha,
      size: Number.isFinite(sizeNum) ? sizeNum : undefined,
    });
  }

  blobs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const warnings: string[] = [];
  const collected: FileSnapshot[] = [];

  async function fetchBlob(blobPath: string, sha: string): Promise<FileSnapshot | null> {
    const r = await ghFetch(`/repos/${owner}/${repo}/git/blobs/${sha}`, token);
    if (!r.ok) return null;
    const j = (await r.json()) as { encoding?: string; content?: string };
    if (j.encoding !== "base64" || !j.content) return null;
    const buf = Buffer.from(j.content.replace(/\s/g, ""), "base64");
    if (buf.includes(0)) return null;
    const text = buf.toString("utf8");
    return { path: blobPath, content: text };
  }

  let totalBytes = 0;

  for (const item of blobs) {
    if (collected.length >= MAX_FILES) {
      treeTruncatedRemote = true;
      break;
    }
    if (
      typeof item.size === "number" &&
      item.size > Math.min(MAX_TOTAL_CONTENT_BYTES, 512 * 1024)
    ) {
      continue;
    }
    const snap = await fetchBlob(item.path, item.sha);
    if (!snap) continue;
    if (totalBytes + snap.content.length > MAX_TOTAL_CONTENT_BYTES) {
      treeTruncatedRemote = true;
      break;
    }
    totalBytes += snap.content.length;
    collected.push(snap);
  }

  if (treeTruncatedRemote) {
    warnings.push(
      "Algunos archivos se omitieron por límites del MVP (tamaño, cantidad o respuesta incompleta de GitHub).",
    );
    if (!token) {
      warnings.push(
        "Sin GITHUB_TOKEN, el límite de peticiones de GitHub puede ser bajo.",
      );
    }
  }

  const limited = applyGlobalLimits(collected, warnings);
  return {
    files: limited.files,
    warnings: limited.warnings,
    truncated: limited.truncated || treeTruncatedRemote,
  };
}
