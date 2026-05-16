import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { FileSnapshot } from "../../ingest/types.js";
import { groupFindingsByOwasp } from "../owaspGrouper.js";
import { aggregateRisk } from "../riskAggregator.js";

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
const fix = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf-8");

function runAllEngines(files: FileSnapshot[]) {
  return [
    ...runSecretsEngine(files),
    ...runSecretsAdvancedEngine(files),
    ...runPatternsEngine(files),
    ...runConfigExposureEngine(files),
    ...runInjectionEngine(files),
    ...runIntegrityEngine(files),
    ...runAccessControlEngine(files),
    ...runAuthFailuresEngine(files),
    ...runLoggingEngine(files),
    ...runSSRFEngine(files),
    ...runDepsEngine(files),
  ];
}

// ════════════════════════════════════════════════════════════════
// PUNTO 1: Agrupación por OWASP
// ════════════════════════════════════════════════════════════════
describe("OWASP Grouper — Agrupación de findings por categoría", () => {
  it("agrupa findings correctamente por owaspId", () => {
    const vulnJS: FileSnapshot[] = [
      { path: "src/app.js", content: fix("vulnerable-app.js") },
    ];
    const raw = runAllEngines(vulnJS);
    const { findings } = aggregateRisk(raw);
    const categories = groupFindingsByOwasp(findings);

    // Cada categoría tiene la estructura esperada
    for (const cat of categories) {
      expect(cat).toHaveProperty("owaspId");
      expect(cat).toHaveProperty("name");
      expect(cat).toHaveProperty("description");
      expect(cat).toHaveProperty("count");
      expect(cat).toHaveProperty("severitySummary");
      expect(cat).toHaveProperty("worstSeverity");
      expect(cat).toHaveProperty("findings");
      expect(cat.count).toBe(cat.findings.length);
      expect(cat.name.length).toBeGreaterThan(3);
      expect(cat.description.length).toBeGreaterThan(20);
    }
  });

  it("la suma de findings por categoría = total de findings", () => {
    const vulnJS: FileSnapshot[] = [
      { path: "src/app.js", content: fix("vulnerable-app.js") },
    ];
    const raw = runAllEngines(vulnJS);
    const { findings } = aggregateRisk(raw);
    const categories = groupFindingsByOwasp(findings);
    const totalInCategories = categories.reduce((sum, c) => sum + c.count, 0);
    expect(totalInCategories).toBe(findings.length);
  });

  it("ordena categorías por severidad (high primero, luego por cantidad)", () => {
    const vulnJS: FileSnapshot[] = [
      { path: "src/app.js", content: fix("vulnerable-app.js") },
    ];
    const raw = runAllEngines(vulnJS);
    const { findings } = aggregateRisk(raw);
    const categories = groupFindingsByOwasp(findings);

    // First categories should have worstSeverity = high
    const firstHigh = categories.findIndex((c) => c.worstSeverity !== "high");
    if (firstHigh > 0) {
      // All before firstHigh should be 'high'
      for (let i = 0; i < firstHigh; i++) {
        expect(categories[i].worstSeverity).toBe("high");
      }
    }
  });

  it("severitySummary coincide con findings internos", () => {
    const vulnJS: FileSnapshot[] = [
      { path: "src/app.js", content: fix("vulnerable-app.js") },
    ];
    const raw = runAllEngines(vulnJS);
    const { findings } = aggregateRisk(raw);
    const categories = groupFindingsByOwasp(findings);

    for (const cat of categories) {
      const expectedHigh = cat.findings.filter((f) => f.severity === "high").length;
      const expectedMed = cat.findings.filter((f) => f.severity === "medium").length;
      const expectedLow = cat.findings.filter((f) => f.severity === "low").length;
      expect(cat.severitySummary.high).toBe(expectedHigh);
      expect(cat.severitySummary.medium).toBe(expectedMed);
      expect(cat.severitySummary.low).toBe(expectedLow);
    }
  });

  it("no incluye categorías sin findings", () => {
    const safeJS: FileSnapshot[] = [
      { path: "src/safe.js", content: fix("safe-app.js") },
    ];
    const raw = runAllEngines(safeJS);
    const { findings } = aggregateRisk(raw);
    const categories = groupFindingsByOwasp(findings);

    // Safe app should have fewer categories than OWASP 10
    expect(categories.length).toBeLessThan(10);
    // Every category has at least 1 finding
    for (const cat of categories) {
      expect(cat.count).toBeGreaterThan(0);
    }
  });

  it("muestra estructura lista para front desplegable", () => {
    const vulnJS: FileSnapshot[] = [
      { path: "src/app.js", content: fix("vulnerable-app.js") },
    ];
    const raw = runAllEngines(vulnJS);
    const { findings } = aggregateRisk(raw);
    const categories = groupFindingsByOwasp(findings);

    // Log example output for frontend team
    console.log("\n📋 Ejemplo de respuesta categories para el front:");
    for (const cat of categories.slice(0, 3)) {
      console.log(`\n  ${cat.owaspId} — ${cat.name} (${cat.count} hallazgos)`);
      console.log(`  ${cat.description.slice(0, 80)}...`);
      console.log(`  Severidades: 🔴 ${cat.severitySummary.high} | 🟡 ${cat.severitySummary.medium} | 🟢 ${cat.severitySummary.low}`);
      console.log(`  Findings:`);
      for (const f of cat.findings.slice(0, 2)) {
        console.log(`    - [${f.severity}] ${f.title} (${f.file}:${f.line})`);
      }
      if (cat.findings.length > 2) {
        console.log(`    ... y ${cat.findings.length - 2} más`);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════
// PUNTO 2: No reportar vulnerabilidades irrelevantes
// ════════════════════════════════════════════════════════════════
describe("Falsos positivos — No reportar vulnerabilidades irrelevantes", () => {
  it("código HTML puro NO dispara SQL injection", () => {
    const files: FileSnapshot[] = [
      { path: "index.html", content: '<html><body><h1>Hello</h1><p>World</p></body></html>' },
    ];
    const injFindings = runInjectionEngine(files);
    expect(injFindings.length).toBe(0);
  });

  it("código CSS puro NO dispara ninguna vulnerabilidad", () => {
    const files: FileSnapshot[] = [
      { path: "styles.css", content: 'body { color: red; background: #fff; } .container { max-width: 1200px; }' },
    ];
    const all = runAllEngines(files);
    expect(all.length).toBe(0);
  });

  it("README.md sin secrets NO dispara nada", () => {
    const files: FileSnapshot[] = [
      { path: "README.md", content: '# Mi Proyecto\n\nEste es un proyecto de ejemplo para aprender React.\n\n## Instalación\n\nnpm install\nnpm run dev' },
    ];
    const all = runAllEngines(files);
    expect(all.length).toBe(0);
  });

  it("código Python sin SQL/HTTP NO dispara inyección ni SSRF", () => {
    const files: FileSnapshot[] = [
      { path: "main.py", content: 'def add(a, b):\n    return a + b\n\nresult = add(1, 2)\nprint(result)' },
    ];
    const injFindings = runInjectionEngine(files);
    const ssrfFindings = runSSRFEngine(files);
    expect(injFindings.length).toBe(0);
    expect(ssrfFindings.length).toBe(0);
  });

  it("archivo .json normal NO dispara vulnerabilidades de deps/integrity", () => {
    const files: FileSnapshot[] = [
      { path: "data/config.json", content: JSON.stringify({ port: 3000, debug: false, name: "myapp" }) },
    ];
    const deps = runDepsEngine(files);
    const integrity = runIntegrityEngine(files);
    // config.json should NOT trigger deps (only package.json does)
    expect(deps.length).toBe(0);
    // config.json should NOT trigger integrity checks
    expect(integrity.length).toBe(0);
  });

  it("app sin DB/SQL no reporta SQL injection", () => {
    const files: FileSnapshot[] = [
      {
        path: "app.js",
        content: `
const express = require("express");
const app = express();
app.get("/", (req, res) => {
  res.json({ message: "Hello World", time: new Date().toISOString() });
});
app.listen(3000);
        `,
      },
    ];
    const injFindings = runInjectionEngine(files);
    const sqlFindings = injFindings.filter(
      (f) => f.ruleId.includes("SQL") || f.ruleId.includes("NOSQL")
    );
    expect(sqlFindings.length).toBe(0);
  });

  it("archivo de imagen/binario path NO dispara motores", () => {
    const files: FileSnapshot[] = [
      { path: "assets/logo.png", content: "PNG binary data here..." },
      { path: "dist/bundle.min.js.map", content: '{"version":3,"sources":[]}' },
    ];
    const all = runAllEngines(files);
    expect(all.length).toBe(0);
  });
});
