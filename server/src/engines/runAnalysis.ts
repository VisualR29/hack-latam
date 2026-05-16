import type { FileSnapshot } from "../ingest/types.js";
import type { AnalysisLimits, AnalysisResult } from "../schemas/findings.js";
import { enrichFindingsEducation } from "../explain/explanationEngine.js";
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

export async function runPipeline(
  files: FileSnapshot[],
  limitsMeta: Pick<AnalysisLimits, "warnings" | "truncated">,
): Promise<AnalysisResult> {
  const aggregatedBytes = files.reduce((sum, f) => sum + f.content.length, 0);

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

  const enriched = await enrichFindingsEducation(deduped);

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
