import { describe, it, expect } from "vitest";
import { runSecretsEngine } from "../secrets.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("secrets engine", () => {
  it("detects obvious AWS key in file", () => {
    const files: FileSnapshot[] = [
      { path: "config/.env", content: "AWS_SECRET_ACCESS_KEY=AKIAEXAMPLEKEY123456" },
    ];
    const findings = runSecretsEngine(files);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("no findings for non-secret text", () => {
    const files: FileSnapshot[] = [
      { path: "README.md", content: "This is a public README with no keys." },
    ];
    const findings = runSecretsEngine(files);
    expect(findings.length).toBe(0);
  });
});
