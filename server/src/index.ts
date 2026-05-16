import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";

import {
  ANALYSIS_TIMEOUT_MS,
  MAX_JSON_BODY_BYTES,
  MAX_ZIP_BYTES,
} from "./constants.js";
import { ingestGithubRepo, ingestRaw, ingestZipFile } from "./ingest/index.js";
import type { AnalysisResult } from "./schemas/findings.js";
import { JsonAnalyzeBodySchema } from "./schemas/findings.js";
import { runPipeline } from "./engines/runAnalysis.js";

dotenv.config();

const PORT = Number(process.env.PORT) || 8787;
const rawClientOrigin =
  process.env.CLIENT_ORIGIN || "http://localhost:5173";
const ALLOWED_ORIGINS = rawClientOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_ZIP_BYTES, files: 1 },
});

const jsonParser = express.json({ limit: MAX_JSON_BODY_BYTES });

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function multipartWhenZip(req: Request, res: Response, next: NextFunction) {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("multipart/form-data")) upload.single("file")(req as never, res, next);
  else next();
}

function conditionalJson(req: Request, res: Response, next: NextFunction) {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (!ct.includes("multipart/form-data")) jsonParser(req, res, next);
  else next();
}

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: ALLOWED_ORIGINS.length > 1 ? ALLOWED_ORIGINS : ALLOWED_ORIGINS[0],
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(ANALYSIS_TIMEOUT_MS + 5_000);
    res.setTimeout(ANALYSIS_TIMEOUT_MS + 5_000);
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "vibeguard-server" });
  });

  app.post(
    "/api/analyze",
    multipartWhenZip as RequestHandler,
    conditionalJson,
    asyncHandler(async (req: Request, res: Response) => {

      if (req.file) {
        const tmpZipPath = req.file.path;
        const extractedDir = await fs.mkdtemp(path.join(os.tmpdir(), "vbg-"));

        try {
          const ingestion = await ingestZipFile(tmpZipPath, extractedDir);

          const result: AnalysisResult = await runPipeline(ingestion.files, {
            warnings: ingestion.warnings,
            truncated: ingestion.truncated,
          });

          res.json(result);
        } finally {
          await fs.rm(tmpZipPath, { force: true }).catch(() => undefined);
          await fs
            .rm(extractedDir, { recursive: true, force: true })
            .catch(() => undefined);
        }
        return;
      }

      const bodyParse = JsonAnalyzeBodySchema.safeParse(req.body ?? {});
      if (!bodyParse.success) {
        res.status(400).json({
          error: "INVALID_BODY",
          message:
            bodyParse.error.issues?.[0]?.message ||
            "Envía {\"mode\":\"raw\", ... } o {\"mode\":\"github\",\"url\":\"...\" }.",
        });
        return;
      }

      const ingestion =
        bodyParse.data.mode === "raw"
          ? ingestRaw(bodyParse.data.code, bodyParse.data.filename)
          : await ingestGithubRepo(
              bodyParse.data.url,
              process.env.GITHUB_TOKEN?.trim(),
            );

      const result: AnalysisResult = await runPipeline(ingestion.files, {
        warnings: ingestion.warnings,
        truncated: ingestion.truncated,
      });

      res.json(result);
    }),
  );

  app.use((err: unknown, _req: Request, res: Response, __next: NextFunction) => {
    console.error(err);

    let status = 500;
    let message = "La petición terminó abruptamente.";
    let code = "SERVER_ERROR";

    if (typeof err === "object" && err && "status" in err && typeof err.status === "number") {
      status = err.status;
    }

    const maybeMsg =
      typeof err === "object" &&
      err &&
      "message" in err &&
      typeof (err as { message?: string }).message === "string"
        ? (err as { message?: string }).message
        : null;

    if (maybeMsg) message = maybeMsg;

    const maybeCode =
      typeof err === "object" &&
      err &&
      "code" in err &&
      typeof (err as { code?: string }).code === "string"
        ? (err as { code?: string }).code
        : null;

    if (maybeCode === "LIMIT_FILE_SIZE") {
      status = 413;
      code = "ZIP_TOO_LARGE";
      message =
        `El ZIP supera los ${Math.round(MAX_ZIP_BYTES / (1024 * 1024))} MB definidos como límite.`;
    }

    res.status(status).json({
      error: code,
      message,
    });
  });

  return app;
}

export const app = createApp();

const shouldBootstrap = !(
  process.env.VITEST === "true" || process.env.NODE_ENV === "test"
);

if (shouldBootstrap) {
  app.listen(PORT, () => {
    console.log(`[vibeguard] servidor listo http://localhost:${PORT}`);
    console.log(
      `[vibeguard] CORS permite: ${ALLOWED_ORIGINS.join(" | ") || rawClientOrigin}`,
    );
  });
}
