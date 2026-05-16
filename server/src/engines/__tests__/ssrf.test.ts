import { describe, it, expect } from "vitest";
import { runSSRFEngine } from "../ssrf.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("ssrf engine", () => {
  it("detects unvalidated fetch to user URL", () => {
    const files: FileSnapshot[] = [
      { path: "src/api.js", content: "fetch(req.body.url).then(r => r.text());" },
    ];
    const findings = runSSRFEngine(files);
    expect(findings.some((f) => f.ruleId === "SSRF_UNVALIDATED_URL")).toBe(true);
  });

  it("does not flag simple static code without URLs", () => {
    const files: FileSnapshot[] = [
      { path: "src/safe.js", content: "const greeting = 'Hello, World!';\nconsole.log(greeting);" },
    ];
    const findings = runSSRFEngine(files);
    expect(findings.length).toBe(0);
  });
});
