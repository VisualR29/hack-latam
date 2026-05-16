import { describe, it, expect } from "vitest";
import { runAccessControlEngine } from "../accessControl.js";
import type { FileSnapshot } from "../../ingest/types.js";

describe("accessControl engine", () => {
  it("detects missing auth on route (IDOR-like)", () => {
    const files: FileSnapshot[] = [
      { path: "routes/public.js", content: "app.get('/user/:id', (req,res)=>{ res.send(getUser(req.params.id)) })" },
    ];
    const findings = runAccessControlEngine(files);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("no findings for protected routes", () => {
    const files: FileSnapshot[] = [
      { path: "routes/protected.js", content: "app.get('/user/:id', ensureAuth, (req,res)=>{})" },
    ];
    const findings = runAccessControlEngine(files);
    expect(findings.length).toBe(0);
  });
});
