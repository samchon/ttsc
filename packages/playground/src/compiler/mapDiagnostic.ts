import type { ITtscCompileResult } from "@ttsc/wasm";

import type { ICompilerService } from "../structures/ICompilerService";
import { lineColumnOf } from "./lineColumnOf";

/**
 * Convert a `@ttsc/wasm` diagnostic into the playground's normalized shape.
 *
 * Native positions and spans count UTF-8 bytes; the editor counts UTF-16
 * units. Source text converts that boundary, including optional coordinates.
 *
 * @evidence contracts/common.md#principled-implementation Native byte offsets and spans are converted against the same source into UTF-16 editor coordinates; optional line/byte-column metadata supplies the start only when the absolute offset is absent.
 * @evidence contracts/common.md#clear-and-simple-design A single mapping keeps WASM diagnostic fields and UI conventions separate from rendering.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Fallback is based on omitted producer metadata, not special casing a diagnostic code or source fixture.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains producer-to-UI conversion and fallback purpose, following documentation-skill paragraph separation.
 * @evidence contracts/performance.md#efficient-algorithms Bounded source scans convert the start, span and line metadata with O(source length) time and constant temporary space, without encoded prefix allocations.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This stateless record mapper does not coordinate equivalent requests; the build pipeline owns its diagnostic population.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It acquires no handles or retained cache and transfers the small output record to its caller.
 */
export function mapDiagnostic(
  diag: NonNullable<ITtscCompileResult["diagnostics"]>[number],
  source: string,
): ICompilerService.IDiagnostic {
  const start = typeof diag.start === "number" && Number.isFinite(diag.start) && diag.start >= 0
    ? utf16OffsetOfBytes(source, diag.start)
    : optionalStart(source, diag.line, diag.character);
  const location = lineColumnOf(source, start);
  const byteLength = typeof diag.length === "number" && Number.isFinite(diag.length)
    ? Math.max(0, Math.trunc(diag.length)) : 0;
  const end = utf16OffsetOfBytes(source, byteLength, start);
  return {
    line: location.line,
    column: location.column,
    length: Math.max(1, end - start),
    severity: diag.category === "warning" ? "warning" : "error",
    message: diag.messageText,
    code: typeof diag.code === "number" ? `TS${diag.code}` : String(diag.code),
  };
}

/** Convert a UTF-8 byte boundary to its JavaScript string offset. */
function utf16OffsetOfBytes(source: string, bytes: number, start = 0): number {
  let offset = start;
  let consumed = 0;
  while (offset < source.length && consumed < bytes) {
    const code = source.codePointAt(offset)!;
    const width = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (consumed + width > bytes) break;
    consumed += width;
    offset += code > 0xffff ? 2 : 1;
  }
  return offset;
}

/** Optional native line and byte-column metadata uses the same source domain. */
function optionalStart(source: string, line: number | undefined, character: number | undefined): number {
  let start = 0;
  const targetLine = typeof line === "number" && Number.isFinite(line) ? Math.max(1, Math.trunc(line)) : 1;
  for (let current = 1; current < targetLine && start < source.length; ++current) {
    while (start < source.length && ![10, 13, 0x2028, 0x2029].includes(source.charCodeAt(start))) ++start;
    const code = source.charCodeAt(start++);
    if (code === 13 && source.charCodeAt(start) === 10) ++start;
  }
  const column = typeof character === "number" && Number.isFinite(character) ? Math.max(0, Math.trunc(character) - 1) : 0;
  return Math.min(source.length, utf16OffsetOfBytes(source, column, start));
}
