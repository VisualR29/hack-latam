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
import { isLearningPremiumEnabled } from "./explain/learningEngine.js";
import { log, newRequestId, startTimer } from "./util/logger.js";

// override: true — si Windows/shell ya define GITHUB_TOKEN (viejo), .env debe ganar.
dotenv.config({ override: true });

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

type Locals = { reqId?: string };

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

  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqId = newRequestId();
    (res.locals as Locals).reqId = reqId;
    const elapsed = startTimer();

    res.on("finish", () => {
      const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      const meta = {
        reqId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: elapsed(),
      };
      if (level === "error") {
        log.error("http.request", "Petición HTTP finalizada con error", undefined, meta);
      } else if (level === "warn") {
        log.warn("http.request", "Petición HTTP con respuesta de cliente", meta);
      } else {
        log.info("http.request", "Petición HTTP completada", meta);
      }
    });

    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "vibeguard-server",
      learningPremium: isLearningPremiumEnabled(),
    });
  });

  app.post(
    "/api/analyze",
    multipartWhenZip as RequestHandler,
    conditionalJson,
    asyncHandler(async (req: Request, res: Response) => {
      const reqId = (res.locals as Locals).reqId ?? newRequestId();
      const totalMs = startTimer();

      const mode = req.file
        ? "zip"
        : (() => {
            const parsed = JsonAnalyzeBodySchema.safeParse(req.body ?? {});
            if (!parsed.success) return "invalid";
            return parsed.data.mode;
          })();

      log.info("analyze.start", "Inicio de análisis", {
        reqId,
        mode,
        contentType: req.headers["content-type"] ?? "",
        zipBytes: req.file?.size,
        zipName: req.file?.originalname,
      });

      if (req.file) {
        const tmpZipPath = req.file.path;
        const extractedDir = await fs.mkdtemp(path.join(os.tmpdir(), "vbg-"));

        try {
          const ingestMs = startTimer();
          const ingestion = await ingestZipFile(tmpZipPath, extractedDir, reqId);
          log.info("analyze.ingest.done", "Ingesta ZIP finalizada", {
            reqId,
            mode: "zip",
            ms: ingestMs(),
            files: ingestion.files.length,
            truncated: ingestion.truncated,
            warnings: ingestion.warnings.length,
          });

          const result: AnalysisResult = await runPipeline(ingestion.files, {
            warnings: ingestion.warnings,
            truncated: ingestion.truncated,
            reqId,
          });

          log.info("analyze.done", "Análisis completado", {
            reqId,
            mode: "zip",
            ms: totalMs(),
            findings: result.findings.length,
            riskScore: result.riskScore,
            trafficLight: result.trafficLight,
            usedAiExplanation: result.usedAiExplanation,
          });

          res.json(result);
        } catch (err) {
          log.error("analyze.failed", "Fallo en análisis ZIP", err, {
            reqId,
            mode: "zip",
            ms: totalMs(),
          });
          throw err;
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
        log.warn("analyze.invalid_body", "Cuerpo JSON inválido", {
          reqId,
          issues: bodyParse.error.issues.map((i) => i.message).slice(0, 3),
        });
        res.status(400).json({
          error: "INVALID_BODY",
          message:
            bodyParse.error.issues?.[0]?.message ||
            "Envía {\"mode\":\"raw\", ... } o {\"mode\":\"github\",\"url\":\"...\" }.",
        });
        return;
      }

      try {
        const ingestMs = startTimer();
        const ingestion =
          bodyParse.data.mode === "raw"
            ? ingestRaw(
                bodyParse.data.code,
                bodyParse.data.filename,
                reqId,
              )
            : await ingestGithubRepo(
                bodyParse.data.url,
                bodyParse.data.githubToken?.trim() || process.env.GITHUB_TOKEN?.trim(),
                reqId,
              );

        log.info("analyze.ingest.done", "Ingesta finalizada", {
          reqId,
          mode: bodyParse.data.mode,
          ms: ingestMs(),
          files: ingestion.files.length,
          truncated: ingestion.truncated,
          warnings: ingestion.warnings.length,
          ...(bodyParse.data.mode === "github"
            ? { repoUrl: bodyParse.data.url }
            : {
                filename:
                  bodyParse.data.filename?.trim() || "pasted-code.txt",
                codeBytes: bodyParse.data.code.length,
              }),
        });

        const result: AnalysisResult = await runPipeline(ingestion.files, {
          warnings: ingestion.warnings,
          truncated: ingestion.truncated,
          reqId,
        });

        log.info("analyze.done", "Análisis completado", {
          reqId,
          mode: bodyParse.data.mode,
          ms: totalMs(),
          findings: result.findings.length,
          riskScore: result.riskScore,
          trafficLight: result.trafficLight,
          usedAiExplanation: result.usedAiExplanation,
        });

        res.json(result);
      } catch (err) {
        log.error("analyze.failed", "Fallo en análisis", err, {
          reqId,
          mode: bodyParse.data.mode,
          ms: totalMs(),
        });
        throw err;
      }
    }),
  );

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const reqId = (res.locals as Locals).reqId;

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

    log.error("http.error", "Error no controlado en petición", err, {
      reqId,
      method: req.method,
      path: req.path,
      status,
      code,
    });

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
    log.info("server.start", "Servidor listo", {
      port: PORT,
      url: `http://localhost:${PORT}`,
      cors: ALLOWED_ORIGINS.join(" | ") || rawClientOrigin,
      logLevel: process.env.LOG_LEVEL ?? "info",
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN?.trim()),
    });
  });
}
