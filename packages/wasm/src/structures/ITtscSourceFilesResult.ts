/** Payload inside `ITtscResult.result` for `getSourceFiles`. */
export interface ITtscSourceFilesResult {
  /** Project-relative paths of non-declaration source files. */
  files: string[];
}
