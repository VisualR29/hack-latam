import { describe, it, expect } from "vitest";
import { runConfigExposureEngine } from "../configExposure.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("configExposure engine", () => {
  it("detects insecure cookie flags missing", () => {
    const files: FileSnapshot[] = [
      { path: "src/server.js", content: "res.cookie('sid', sid, { httpOnly: false });" },
    ];
    const findings = runConfigExposureEngine(files);
    expect(findings.some((f) => f.ruleId.includes('COOKIE') || f.owaspId === 'A04')).toBe(true);
  });

  it("does not flag safe cookie usage", () => {
    const files: FileSnapshot[] = [
      { path: "src/server.js", content: "res.cookie('sid', sid, { httpOnly: true, secure: true });" },
    ];
    const findings = runConfigExposureEngine(files);
    expect(findings.length).toBe(0);
  });
});
