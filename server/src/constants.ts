export const ANALYSIS_TIMEOUT_MS = 120_000;
export const MAX_FILES = 200;
export const MAX_TOTAL_CONTENT_BYTES = 5 * 1024 * 1024;
export const MAX_ZIP_BYTES = 10 * 1024 * 1024;
export const MAX_JSON_BODY_BYTES = 1 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".md",
]);

export const IGNORE_PATH_PREFIXES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "vendor/",
  "__pycache__/",
];
