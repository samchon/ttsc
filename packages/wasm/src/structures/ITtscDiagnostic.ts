/**
 * A single TypeScript compiler diagnostic emitted during `build`, `check`, or
 * `transform`. `line` and `character` are 0-based.
 */
export interface ITtscDiagnostic {
  file: string | null;
  category: "error" | "warning";
  code: number;
  start?: number;
  length?: number;
  line?: number;
  character?: number;
  messageText: string;
}
