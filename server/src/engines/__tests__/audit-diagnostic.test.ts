import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { FileSnapshot } from "../../ingest/types.js";

import { runSecretsEngine } from "../secrets.js";
import { runSecretsAdvancedEngine } from "../secretsAdvanced.js";
import { runPatternsEngine } from "../patterns.js";
import { runConfigExposureEngine } from "../configExposure.js";
import { runInjectionEngine } from "../injection.js";
import { runIntegrityEngine } from "../integrity.js";
import { runAccessControlEngine } from "../accessControl.js";
import { runAuthFailuresEngine } from "../authFailures.js";
import { runLoggingEngine } from "../logging.js";
import { runSSRFEngine } from "../ssrf.js";
import { runDepsEngine } from "../deps.js";
import { aggregateRisk } from "../riskAggregator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const auditCode = readFileSync(
  join(__dirname, "../../..", "audits", "insecure.js"),
  "utf-8",
);

describe("AUDIT: insecure.js — 1 vulnerabilidad real, el resto seguro", () => {
  it("diagnóstico completo de findings", () => {
    const files: FileSnapshot[] = [
      { path: "src/insecure.js", content: auditCode },
    ];

    const engines = [
      { name: "secrets", fn: runSecretsEngine },
      { name: "secretsAdvanced", fn: runSecretsAdvancedEngine },
      { name: "patterns", fn: runPatternsEngine },
      { name: "configExposure", fn: runConfigExposureEngine },
      { name: "injection", fn: runInjectionEngine },
      { name: "integrity", fn: runIntegrityEngine },
      { name: "accessControl", fn: runAccessControlEngine },
      { name: "authFailures", fn: runAuthFailuresEngine },
      { name: "logging", fn: runLoggingEngine },
      { name: "ssrf", fn: runSSRFEngine },
      { name: "deps", fn: runDepsEngine },
    ];

    let allFindings: any[] = [];
    for (const eng of engines) {
      const findings = eng.fn(files);
      if (findings.length > 0) {
        console.log(`\n=== ${eng.name} (${findings.length} findings) ===`);
        for (const f of findings) {
          console.log(
            `  [${f.severity}] ${f.ruleId}: ${f.title}`,
          );
          console.log(`    Line ${f.line}: ${f.description.slice(0, 120)}`);
        }
      }
      allFindings.push(...findings);
    }

    const { findings, riskScore, secureScore, trafficLight } =
      aggregateRisk(allFindings);

    console.log(`\n📊 TOTAL: ${findings.length} findings`);
    console.log(`   Risk: ${riskScore} | Secure: ${secureScore} | Semáforo: ${trafficLight}`);
  });
});
