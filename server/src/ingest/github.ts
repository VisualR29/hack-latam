import {
  MAX_FILES,
  MAX_TOTAL_CONTENT_BYTES,
} from "../constants.js";
import { shouldIncludePath, applyGlobalLimits } from "./filters.js";
import { log } from "../util/logger.js";
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
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`https://api.github.com${path}`, { headers });
}

function messageForRepoError(status: number, tokenWasRejected: boolean): string {
  if (status === 401) {
    if (tokenWasRejected) {
      return (
        "GITHUB_TOKEN inválido, expirado o revocado. Creá un token nuevo en GitHub " +
        "(Settings → Developer settings → Personal access tokens) con scope «repo», " +
        "actualizá server/.env y reiniciá npm run dev. Para repos públicos podés dejar GITHUB_TOKEN vacío."
      );
    }
    return "GitHub rechazó la autenticación (401).";
  }
  if (status === 403) {
    return (
      "GitHub limitó el acceso (403). Puede ser rate limit: esperá unos minutos o usá un GITHUB_TOKEN válido."
    );
  }
  if (status === 404) {
    return (
      "Repositorio no encontrado o privado. Para repos privados necesitás un GITHUB_TOKEN válido con permiso de lectura (scope «repo»)."
    );
  }
  return `GitHub respondió ${status} al leer el repositorio.`;
}

/** Si el token guardado es inválido, GitHub devuelve 401 incluso en repos públicos. Reintentamos sin token. */
async function ghFetchWithTokenFallback(
  path: string,
  token: string | undefined,
  reqId: string | undefined,
  context: string,
): Promise<{ response: Response; effectiveToken?: string; tokenRejected: boolean }> {
  const first = await ghFetch(path, token);
  if (first.status !== 401 || !token) {
    return { response: first, effectiveToken: token, tokenRejected: false };
  }

  log.warn("ingest.github.token_rejected", "Token rechazado por GitHub; reintento sin autenticación", {
    reqId,
    context,
    path,
  });

  const retry = await ghFetch(path, undefined);
  return {
    response: retry,
    effectiveToken: retry.ok ? undefined : token,
    tokenRejected: true,
  };
}

export async function ingestGithubRepo(
  repoUrl: string,
  token?: string,
  reqId?: string,
): Promise<IngestOutcome> {
  log.info("ingest.github.start", "Ingesta desde GitHub", {
    reqId,
    repoUrl,
    hasToken: Boolean(token),
  });

  const parsed = parseGithubRepoUrl(repoUrl);
  if (!parsed) {
    log.warn("ingest.github.invalid_url", "URL de GitHub inválida", { reqId, repoUrl });
    return {
      files: [],
      warnings: [
        "URL de GitHub no válida. Usa un repositorio público https://github.com/usuario/repo",
      ],
      truncated: false,
    };
  }

  const { owner, repo } = parsed;
  const repoAttempt = await ghFetchWithTokenFallback(
    `/repos/${owner}/${repo}`,
    token,
    reqId,
    "read_repo",
  );
  const authToken = repoAttempt.effectiveToken;

  if (!repoAttempt.response.ok) {
    const msg = messageForRepoError(
      repoAttempt.response.status,
      repoAttempt.tokenRejected,
    );
    log.warn("ingest.github.repo_failed", msg, {
      reqId,
      owner,
      repo,
      status: repoAttempt.response.status,
      tokenRejected: repoAttempt.tokenRejected,
    });
    return { files: [], warnings: [msg], truncated: false };
  }
  const repoJson = (await repoAttempt.response.json()) as { default_branch?: string };
  const branch = repoJson.default_branch || "main";

  const treeAttempt = await ghFetchWithTokenFallback(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    authToken,
    reqId,
    "read_tree",
  );
  const treeRes = treeAttempt.response;
  if (!treeRes.ok) {
    const msg = messageForRepoError(treeRes.status, treeAttempt.tokenRejected);
    log.warn("ingest.github.tree_failed", msg, {
      reqId,
      owner,
      repo,
      branch,
      status: treeRes.status,
    });
    return {
      files: [],
      warnings: [msg],
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
    const r = await ghFetch(`/repos/${owner}/${repo}/git/blobs/${sha}`, authToken);
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
    if (!authToken) {
      warnings.push(
        "Sin GITHUB_TOKEN válido, el límite de peticiones de GitHub puede ser bajo.",
      );
    }
    if (token && !authToken) {
      warnings.push(
        "Se ignoró GITHUB_TOKEN del .env porque GitHub lo rechazó (inválido o expirado). Actualizalo para repos privados.",
      );
    }
  }

  const limited = applyGlobalLimits(collected, warnings);

  log.info("ingest.github.done", "Ingesta GitHub finalizada", {
    reqId,
    owner,
    repo,
    branch,
    blobsConsidered: blobs.length,
    filesKept: limited.files.length,
    truncated: limited.truncated || treeTruncatedRemote,
    warnings: limited.warnings.length,
  });

  return {
    files: limited.files,
    warnings: limited.warnings,
    truncated: limited.truncated || treeTruncatedRemote,
  };
}
