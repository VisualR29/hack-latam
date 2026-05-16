import { describe, it, expect } from "vitest";
import { runPipeline } from "../runAnalysis.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("runAnalysis pipeline integration", () => {
  it("runs the full pipeline and returns an AnalysisResult shape", async () => {
    const files: FileSnapshot[] = [
      { path: "app.js", content: "fetch(req.body.url); console.log('pw: '+password); const q = `SELECT * FROM users WHERE id = ${req.params.id}`;" },
    ];

    const res = await runPipeline(files, { warnings: [], truncated: false });
    expect(res).toHaveProperty('riskScore');
    expect(res).toHaveProperty('trafficLight');
    expect(Array.isArray(res.findings)).toBe(true);
  });
});
