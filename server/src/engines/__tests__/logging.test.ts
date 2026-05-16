import { describe, it, expect } from "vitest";
import { runLoggingEngine } from "../logging.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("logging engine", () => {
  it("detects sensitive data logged", () => {
    const files: FileSnapshot[] = [
      { path: "src/logs.js", content: "console.log('user password: ' + password);" },
    ];
    const findings = runLoggingEngine(files);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("no findings for structured safe logs", () => {
    const files: FileSnapshot[] = [
      { path: "src/logs.js", content: "logger.info({event:'login', userId});" },
    ];
    const findings = runLoggingEngine(files);
    expect(findings.length).toBe(0);
  });
});
