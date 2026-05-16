import type { FileSnapshot } from "../ingest/types.js";
import type { AnalysisLimits, AnalysisResult } from "../schemas/findings.js";
import { enrichFindingsEducation } from "../explain/explanationEngine.js";
import { log, startTimer } from "../util/logger.js";
import { runSecretsEngine } from "./secrets.js";
import { runSecretsAdvancedEngine } from "./secretsAdvanced.js";
import { runDepsEngine } from "./deps.js";
import { runPatternsEngine } from "./patterns.js";
import { runConfigExposureEngine } from "./configExposure.js";
import { runInjectionEngine } from "./injection.js";
import { runIntegrityEngine } from "./integrity.js";
import { runAccessControlEngine } from "./accessControl.js";
import { runAuthFailuresEngine } from "./authFailures.js";
import { runLoggingEngine } from "./logging.js";
import { runSSRFEngine } from "./ssrf.js";
import { aggregateRisk } from "./riskAggregator.js";

type PipelineMeta = Pick<AnalysisLimits, "warnings" | "truncated"> & {
  reqId?: string;
};

export async function runPipeline(
  files: FileSnapshot[],
  limitsMeta: PipelineMeta,
): Promise<AnalysisResult> {
  const { reqId } = limitsMeta;
  const pipelineMs = startTimer();
  const aggregatedBytes = files.reduce((sum, f) => sum + f.content.length, 0);

  log.info("pipeline.start", "Inicio del pipeline de análisis", {
    reqId,
    files: files.length,
    totalBytesApprox: aggregatedBytes,
    truncated: limitsMeta.truncated,
    ingestWarnings: limitsMeta.warnings.length,
  });

  const enginesMs = startTimer();
  const secrets = runSecretsEngine(files);
  const deps = runDepsEngine(files);
  const patterns = runPatternsEngine(files);
  const configExposure = runConfigExposureEngine(files);

  log.debug("pipeline.engines", "Motores heurísticos ejecutados", {
    reqId,
    ms: enginesMs(),
    secrets: secrets.length,
    deps: deps.length,
    patterns: patterns.length,
    configExposure: configExposure.length,
  });

  const mergedFindingsRaw = [
    ...runSecretsEngine(files),
    ...runSecretsAdvancedEngine(files),
    ...runDepsEngine(files),
    ...runPatternsEngine(files),
    ...runConfigExposureEngine(files),
    ...runInjectionEngine(files),
    ...runIntegrityEngine(files),
    ...runAccessControlEngine(files),
    ...runAuthFailuresEngine(files),
    ...runLoggingEngine(files),
    ...runSSRFEngine(files),
  ];

  const { findings: deduped, riskScore, trafficLight } =
    aggregateRisk(mergedFindingsRaw);

  log.info("pipeline.aggregate", "Hallazgos agregados", {
    reqId,
    rawCount: mergedFindingsRaw.length,
    dedupedCount: deduped.length,
    riskScore,
    trafficLight,
  });

  const enrichMs = startTimer();
  const enriched = await enrichFindingsEducation(deduped, reqId);

  log.info("pipeline.done", "Pipeline finalizado", {
    reqId,
    ms: pipelineMs(),
    enrichMs: enrichMs(),
    findings: enriched.findings.length,
    usedAiExplanation: enriched.usedAiExplanation,
  });

  const limits: AnalysisLimits = {
    filesProcessed: files.length,
    totalBytesApprox: aggregatedBytes,
    truncated: limitsMeta.truncated,
    warnings: limitsMeta.warnings,
  };

  return {
    riskScore,
    trafficLight,
    findings: enriched.findings,
    limits,
    usedAiExplanation: enriched.usedAiExplanation,
  };
}
