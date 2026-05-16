import { describe, it, expect } from "vitest";
import { runInjectionEngine } from "../injection.js";
import { runPatternsEngine } from "../patterns.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("injection engine", () => {
  it("detects SQL concatenation (positive)", () => {
    const files: FileSnapshot[] = [
      { path: "app/controllers/user.js", content: "const q = `SELECT * FROM users WHERE id = ${req.params.id}` + ` LIMIT 1`;" },
    ];
    // Either injection or patterns engine should catch SQL concat
    const injFindings = runInjectionEngine(files);
    const patFindings = runPatternsEngine(files);
    const all = [...injFindings, ...patFindings].filter(f => f.owaspId === "A03" || f.owaspId === "A05");
    expect(all.length).toBeGreaterThan(0);
  });

  it("returns no findings for safe code (negative)", () => {
    const files: FileSnapshot[] = [
      { path: "app/controllers/safe.js", content: "const q = db.prepare('SELECT * FROM users WHERE id = ?');" },
    ];
    const findings = runInjectionEngine(files);
    expect(findings.length).toBe(0);
  });
});
