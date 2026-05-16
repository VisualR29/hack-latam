import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { FileSnapshot } from "../../ingest/types.js";
import type { Finding } from "../../schemas/findings.js";

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const auditDir = join(__dirname, "../../..", "audits", "fixtures");

function loadFixture(name: string): FileSnapshot[] {
  const content = readFileSync(join(auditDir, name), "utf-8");
  return [{ path: `src/${name}`, content }];
}

function logFindings(findings: Finding[], label: string) {
  if (findings.length === 0) {
    console.log(`  ✅ ${label}: 0 findings`);
  } else {
    console.log(`  📋 ${label}: ${findings.length} findings`);
    for (const f of findings) {
      console.log(`    [${f.severity}] ${f.ruleId} — ${f.title} (line ${f.line})`);
    }
  }
}

describe("AUDIT ENGINE: Secrets (A02)", () => {
  it("SEGURO: no flaggea variables de entorno", () => {
    const files = loadFixture("secrets-safe.js");
    const secretsFindings = [...runSecretsEngine(files), ...runSecretsAdvancedEngine(files)];
    logFindings(secretsFindings, "secrets-safe");
    expect(secretsFindings.length).toBe(0);
  });
  it("VULNERABLE: detecta secrets hardcoded", () => {
    const files = loadFixture("secrets-vuln.js");
    const secretsFindings = [...runSecretsEngine(files), ...runSecretsAdvancedEngine(files)];
    logFindings(secretsFindings, "secrets-vuln");
    expect(secretsFindings.length).toBeGreaterThanOrEqual(4);
  });
});

describe("AUDIT ENGINE: Injection (A03)", () => {
  it("SEGURO: prepared statements y paths seguros = 0 injection findings", () => {
    const files = loadFixture("injection-safe.js");
    const injFindings = runInjectionEngine(files);
    logFindings(injFindings, "injection-safe");
    expect(injFindings.length).toBe(0);
  });
  it("VULNERABLE: detecta SQL injection, NoSQL, path traversal", () => {
    const files = loadFixture("injection-vuln.js");
    const injFindings = runInjectionEngine(files);
    logFindings(injFindings, "injection-vuln");
    expect(injFindings.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AUDIT ENGINE: Access Control (A01)", () => {
  it("SEGURO: rutas protegidas con auth middleware = 0 access control findings", () => {
    const files = loadFixture("access-safe.js");
    const acFindings = runAccessControlEngine(files);
    logFindings(acFindings, "access-safe");
    expect(acFindings.length).toBe(0);
  });
  it("VULNERABLE: detecta rutas sin auth, IDOR, privilege escalation", () => {
    const files = loadFixture("access-vuln.js");
    const acFindings = runAccessControlEngine(files);
    logFindings(acFindings, "access-vuln");
    expect(acFindings.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AUDIT ENGINE: Auth Failures (A07)", () => {
  it("SEGURO: JWT con exp, bcrypt, crypto tokens = 0 auth findings", () => {
    const files = loadFixture("auth-safe.js");
    const authFindings = runAuthFailuresEngine(files);
    logFindings(authFindings, "auth-safe");
    expect(authFindings.length).toBe(0);
  });
  it("VULNERABLE: detecta JWT sin exp, weak token, enumeration", () => {
    const files = loadFixture("auth-vuln.js");
    const authFindings = runAuthFailuresEngine(files);
    logFindings(authFindings, "auth-vuln");
    expect(authFindings.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AUDIT ENGINE: Config Exposure (A04)", () => {
  it("SEGURO: helmet + CORS restrictivo + cookies seguras = 0 config findings", () => {
    const files = loadFixture("config-safe.js");
    const configFindings = runConfigExposureEngine(files);
    logFindings(configFindings, "config-safe");
    expect(configFindings.length).toBe(0);
  });
  it("VULNERABLE: detecta CORS wildcard, debug, cookies inseguras", () => {
    const files = loadFixture("config-vuln.js");
    const configFindings = runConfigExposureEngine(files);
    logFindings(configFindings, "config-vuln");
    expect(configFindings.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AUDIT ENGINE: Logging (A09)", () => {
  it("SEGURO: winston structured logging = 0 logging findings", () => {
    const files = loadFixture("logging-safe.js");
    const logFinds = runLoggingEngine(files);
    logFindings(logFinds, "logging-safe");
    expect(logFinds.length).toBe(0);
  });
  it("VULNERABLE: detecta console.log y datos sensibles en logs", () => {
    const files = loadFixture("logging-vuln.js");
    const logFinds = runLoggingEngine(files);
    logFindings(logFinds, "logging-vuln");
    expect(logFinds.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AUDIT ENGINE: SSRF (A10)", () => {
  it("SEGURO: URL allowlist + TLS verificado = 0 SSRF findings", () => {
    const files = loadFixture("ssrf-safe.js");
    const ssrfFindings = runSSRFEngine(files);
    logFindings(ssrfFindings, "ssrf-safe");
    expect(ssrfFindings.length).toBe(0);
  });
  it("VULNERABLE: detecta user URL, metadata, rejectUnauthorized false", () => {
    const files = loadFixture("ssrf-vuln.js");
    const ssrfFindings = runSSRFEngine(files);
    logFindings(ssrfFindings, "ssrf-vuln");
    expect(ssrfFindings.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AUDIT ENGINE: Patterns (A05)", () => {
  it("SEGURO: DOMPurify + JSON.parse + safe templates = 0 pattern findings", () => {
    const files = loadFixture("patterns-safe.js");
    const patFindings = runPatternsEngine(files);
    logFindings(patFindings, "patterns-safe");
    expect(patFindings.length).toBe(0);
  });
  it("VULNERABLE: detecta eval, innerHTML, new Function", () => {
    const files = loadFixture("patterns-vuln.js");
    const patFindings = runPatternsEngine(files);
    logFindings(patFindings, "patterns-vuln");
    expect(patFindings.length).toBeGreaterThanOrEqual(3);
  });
});

describe("REPORTE DE FIABILIDAD", () => {
  it("genera resumen de todos los engines aislados", () => {
    const fixtures = [
      "secrets-safe.js", "secrets-vuln.js",
      "injection-safe.js", "injection-vuln.js",
      "access-safe.js", "access-vuln.js",
      "auth-safe.js", "auth-vuln.js",
      "config-safe.js", "config-vuln.js",
      "logging-safe.js", "logging-vuln.js",
      "ssrf-safe.js", "ssrf-vuln.js",
      "patterns-safe.js", "patterns-vuln.js",
    ];

    let totalSafeFP = 0;
    let totalVulnDetected = 0;
    let totalVuln = 0;

    for (let i = 0; i < fixtures.length; i += 2) {
      const safeName = fixtures[i];
      const vulnName = fixtures[i + 1];
      const engineArea = safeName.replace("-safe.js", "").toUpperCase();

      const safeFiles = loadFixture(safeName);
      const vulnFiles = loadFixture(vulnName);

      let engineFn: any;
      switch (engineArea) {
        case "SECRETS": engineFn = (f: any) => [...runSecretsEngine(f), ...runSecretsAdvancedEngine(f)]; break;
        case "INJECTION": engineFn = runInjectionEngine; break;
        case "ACCESS": engineFn = runAccessControlEngine; break;
        case "AUTH": engineFn = runAuthFailuresEngine; break;
        case "CONFIG": engineFn = runConfigExposureEngine; break;
        case "LOGGING": engineFn = runLoggingEngine; break;
        case "SSRF": engineFn = runSSRFEngine; break;
        case "PATTERNS": engineFn = runPatternsEngine; break;
      }

      const safeFindings = engineFn(safeFiles);
      const safeFP = safeFindings.filter((f: any) => !f.ruleId.startsWith("LOGGING_CONSOLE"));
      const vulnFindings = engineFn(vulnFiles);

      totalSafeFP += safeFP.length;
      totalVuln++;
      if (vulnFindings.length > 0) totalVulnDetected++;
      
      if (safeFP.length > 0) {
        for (const f of safeFP) {
          console.error(`FP [${engineArea}]: ${f.ruleId} en ${safeName}`);
        }
      }
    }

    const detectionRate = Math.round((totalVulnDetected / totalVuln) * 100);
    expect(totalSafeFP).toBe(0);
    expect(detectionRate).toBe(100);
  });
});
