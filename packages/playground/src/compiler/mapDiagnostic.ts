import type { ITtscCompileResult } from "@ttsc/wasm";

import type { ICompilerService } from "../structures/ICompilerService";
import { lineColumnOf } from "./lineColumnOf";

/**
 * Convert a `@ttsc/wasm` diagnostic into the playground's normalized shape.
 *
 * Falls back to computing line/column from the source text when the wasm
 * diagnostic did not carry them (some plugin emitters drop them).
 *
 * @evidence contracts/common.md#principled-implementation Producer coordinates take precedence when positive; source offsets supply missing coordinates, and spans are clamped to the UI's minimum of one character.
 * @evidence contracts/common.md#clear-and-simple-design A single mapping keeps WASM diagnostic fields and UI conventions separate from rendering.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Fallback is based on omitted producer metadata, not special casing a diagnostic code or source fixture.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains producer-to-UI conversion and fallback purpose, following documentation-skill paragraph separation.
 * @evidence contracts/performance.md#efficient-algorithms Complete producer coordinates require constant mapping work; missing coordinates invoke one O(offset) source scan with constant temporary space rather than always scanning every diagnostic's prefix.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This stateless record mapper does not coordinate equivalent requests; the build pipeline owns its diagnostic population.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It acquires no handles or retained cache and transfers the small output record to its caller.
 */
export function mapDiagnostic(
  diag: NonNullable<ITtscCompileResult["diagnostics"]>[number],
  source: string,
): ICompilerService.IDiagnostic {
  const fallback =
    diag.line && diag.line > 0 && diag.character && diag.character > 0
      ? { line: diag.line, column: diag.character }
      : lineColumnOf(source, diag.start);
  return {
    line: diag.line && diag.line > 0 ? diag.line : fallback.line,
    column:
      diag.character && diag.character > 0 ? diag.character : fallback.column,
    length:
      typeof diag.length === "number" && Number.isFinite(diag.length)
        ? Math.max(1, Math.trunc(diag.length))
        : 1,
    severity: diag.category === "warning" ? "warning" : "error",
    message: diag.messageText,
    code: typeof diag.code === "number" ? `TS${diag.code}` : String(diag.code),
  };
}
