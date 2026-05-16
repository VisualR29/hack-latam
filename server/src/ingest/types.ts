export type FileSnapshot = {
  path: string;
  content: string;
};

export type IngestOutcome = {
  files: FileSnapshot[];
  warnings: string[];
  truncated: boolean;
};
