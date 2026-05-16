import { describe, it, expect } from "vitest";
import { runPatternsEngine } from "../patterns.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("patterns engine", () => {
  it("detects insecure deserialization pattern for Java ObjectInputStream", () => {
    const files: FileSnapshot[] = [
      { path: "src/Util.java", content: "new ObjectInputStream(input).readObject();" },
    ];
    const findings = runPatternsEngine(files);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("no findings for safe code", () => {
    const files: FileSnapshot[] = [{ path: "src/Util.java", content: "// safe util" }];
    const findings = runPatternsEngine(files);
    expect(findings.length).toBe(0);
  });
});
