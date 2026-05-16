import { describe, it, expect } from "vitest";
import { runAuthFailuresEngine } from "../authFailures.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("authFailures engine", () => {
  it("detects weak password check usage", () => {
    const files: FileSnapshot[] = [
      { path: "auth/login.js", content: "function validatePassword(pw) { if (pw.length <= 4) return false; }" },
    ];
    const findings = runAuthFailuresEngine(files);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("no findings when using strong check", () => {
    const files: FileSnapshot[] = [
      { path: "auth/login.js", content: "if (pw.length >= 12 && hasNumbers && hasSymbols) {}" },
    ];
    const findings = runAuthFailuresEngine(files);
    expect(findings.length).toBe(0);
  });
});
