import { applyGlobalLimits } from "./filters.js";
import type { IngestOutcome } from "./types.js";

const DEFAULT_NAME = "pasted-code.txt";

export function ingestRaw(code: string, filename?: string): IngestOutcome {
  const name = filename?.trim() || DEFAULT_NAME;
  const { files, warnings, truncated } = applyGlobalLimits(
    [{ path: name, content: code }],
    [],
  );
  return { files, warnings, truncated };
}
