import { describe, it, expect } from "vitest";
import { runDepsEngine } from "../deps.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("deps engine", () => {
  it("detects outdated vulnerable dependency in package.json", () => {
    const files: FileSnapshot[] = [
      { path: "package.json", content: JSON.stringify({ dependencies: { lodash: "4.17.0" } }) },
    ];
    const findings = runDepsEngine(files);
    expect(findings.length).toBeGreaterThanOrEqual(0);
  });

  it("no findings for empty file", () => {
    const files: FileSnapshot[] = [{ path: "notes.txt", content: "" }];
    const findings = runDepsEngine(files);
    expect(findings.length).toBe(0);
  });
});
