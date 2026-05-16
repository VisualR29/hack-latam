import { describe, it, expect } from "vitest";
import { runSecretsAdvancedEngine } from "../secretsAdvanced.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("secretsAdvanced engine", () => {
  it("detects common provider keys (Stripe) in source", () => {
    const files: FileSnapshot[] = [
      { path: "src/payments.js", content: "const stripeKey = 'sk_live_51H0example';" },
    ];
    const findings = runSecretsAdvancedEngine(files);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("no findings for lorem text", () => {
    const files: FileSnapshot[] = [{ path: "notes.txt", content: "lorem ipsum" }];
    const findings = runSecretsAdvancedEngine(files);
    expect(findings.length).toBe(0);
  });
});
