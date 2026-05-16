import type { FileSnapshot } from "../ingest/types.js";
import type { AnalysisLimits, AnalysisResult } from "../schemas/findings.js";
import { enrichFindingsEducation } from "../explain/explanationEngine.js";
import { runSecretsEngine } from "./secrets.js";
import { runDepsEngine } from "./deps.js";
import { runPatternsEngine } from "./patterns.js";
import { runConfigExposureEngine } from "./configExposure.js";
import { aggregateRisk } from "./riskAggregator.js";

export async function runPipeline(
  files: FileSnapshot[],
  limitsMeta: Pick<AnalysisLimits, "warnings" | "truncated">,
): Promise<AnalysisResult> {
  const aggregatedBytes = files.reduce((sum, f) => sum + f.content.length, 0);

  const mergedFindingsRaw = [
    ...runSecretsEngine(files),
    ...runDepsEngine(files),
    ...runPatternsEngine(files),
    ...runConfigExposureEngine(files),
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
