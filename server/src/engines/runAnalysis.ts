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
import { groupFindingsByOwasp } from "./owaspGrouper.js";

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
  const secretsAdvanced = runSecretsAdvancedEngine(files);
  const deps = runDepsEngine(files);
  const patterns = runPatternsEngine(files);
  const configExposure = runConfigExposureEngine(files);
  const injection = runInjectionEngine(files);
  const integrity = runIntegrityEngine(files);
  const accessControl = runAccessControlEngine(files);
  const authFailures = runAuthFailuresEngine(files);
  const loggingFindings = runLoggingEngine(files);
  const ssrf = runSSRFEngine(files);

  log.debug("pipeline.engines", "Motores heurísticos ejecutados", {
    reqId,
    ms: enginesMs(),
    secrets: secrets.length,
    secretsAdvanced: secretsAdvanced.length,
    deps: deps.length,
    patterns: patterns.length,
    configExposure: configExposure.length,
    injection: injection.length,
    integrity: integrity.length,
    accessControl: accessControl.length,
    authFailures: authFailures.length,
    logging: loggingFindings.length,
    ssrf: ssrf.length,
  });

  const mergedFindingsRaw = [
    ...secrets,
    ...secretsAdvanced,
    ...deps,
    ...patterns,
    ...configExposure,
    ...injection,
    ...integrity,
    ...accessControl,
    ...authFailures,
    ...loggingFindings,
    ...ssrf,
  ];

  const { findings: deduped, riskScore, secureScore, trafficLight } =
    aggregateRisk(mergedFindingsRaw);

  log.info("pipeline.aggregate", "Hallazgos agregados", {
    reqId,
    rawCount: mergedFindingsRaw.length,
    dedupedCount: deduped.length,
    riskScore,
    secureScore,
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

  const categories = groupFindingsByOwasp(enriched.findings);

  return {
    riskScore,
    secureScore,
    trafficLight,
    findings: enriched.findings,
    categories,
    limits,
    usedAiExplanation: enriched.usedAiExplanation,
  };
}
