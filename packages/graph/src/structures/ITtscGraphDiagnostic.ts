/**
 * A compiler or plugin diagnostic, fused onto the graph so an edit-triage query
 * can name the owning symbol of an error.
 *
 * The TypeScript semantic pass contributes numeric-coded `tsc` diagnostics;
 * `@ttsc/lint` rules and transform plugins (typia, nestia, …) contribute
 * `plugin`/`lint` findings whose `code` is a string. `node` is set when the
 * finding's position was attributed to a graph node.
 */
export interface ITtscGraphDiagnostic {
  /** Project-relative path of the file the diagnostic is reported in. */
  file: string;

  /** 1-based line of the diagnostic. */
  line: number;

  /** 1-based column of the diagnostic, when known. */
  column?: number;

  /** Numeric `tsc` code, or string rule id for a lint/plugin finding. */
  code: number | string;

  /** The human-readable diagnostic message. */
  message: string;

  /** Severity, when the producer distinguishes it. */
  severity?: "error" | "warning" | "info" | "hint";

  /** Which lane produced the diagnostic. */
  origin?: "tsc" | "plugin" | "lint";

  /** Node id the diagnostic was fused onto, when resolved. */
  node?: string;
}
