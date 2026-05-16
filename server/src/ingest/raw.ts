import { applyGlobalLimits } from "./filters.js";
import { log } from "../util/logger.js";
import type { IngestOutcome } from "./types.js";

const DEFAULT_NAME = "pasted-code.txt";

export function ingestRaw(
  code: string,
  filename?: string,
  reqId?: string,
): IngestOutcome {
  const name = filename?.trim() || DEFAULT_NAME;
  const { files, warnings, truncated } = applyGlobalLimits(
    [{ path: name, content: code }],
    [],
  );

  log.debug("ingest.raw", "Código pegado normalizado", {
    reqId,
    filename: name,
    codeBytes: code.length,
    files: files.length,
    truncated,
  });

  return { files, warnings, truncated };
}
