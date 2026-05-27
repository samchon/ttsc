import type { ITtscCompileResult } from "@ttsc/wasm";

import type { ICompilerService } from "../structures/ICompilerService";
import { lineColumnOf } from "./lineColumnOf";

/**
 * Convert a `@ttsc/wasm` diagnostic into the playground's normalized shape.
 *
 * Falls back to computing line/column from the source text when the wasm
 * diagnostic did not carry them (some plugin emitters drop them).
 */
export function mapDiagnostic(
  diag: NonNullable<ITtscCompileResult["diagnostics"]>[number],
  source: string,
): ICompilerService.IDiagnostic {
  const fallback = lineColumnOf(source, diag.start);
  return {
    line: diag.line && diag.line > 0 ? diag.line : fallback.line,
    column:
      diag.character && diag.character > 0 ? diag.character : fallback.column,
    length: typeof diag.length === "number" ? diag.length : 1,
    severity: diag.category === "warning" ? "warning" : "error",
    message: diag.messageText,
    code: typeof diag.code === "number" ? `TS${diag.code}` : String(diag.code),
  };
}
