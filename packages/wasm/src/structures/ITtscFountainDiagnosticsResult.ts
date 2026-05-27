import type { ITtscDiagnostic } from "./ITtscDiagnostic";

/** Payload inside `ITtscResult.result` for `getDiagnostics`. */
export interface ITtscFountainDiagnosticsResult {
  diagnostics: ITtscDiagnostic[];
}
