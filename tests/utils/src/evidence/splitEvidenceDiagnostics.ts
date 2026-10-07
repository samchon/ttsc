/**
 * Separates compiler diagnostic banners while retaining their continuation
 * text.
 *
 * @evidence contracts/common.md#principled-implementation Authored compiler text is normalized and split at plain or source-qualified diagnostic banners; project findings and duplicate chunks remain visible.
 * @evidence contracts/common.md#clear-and-simple-design One pure string operation serves both consumer assertions and its direct unit without copied implementations or a compiler-shaped response.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Splitting cannot invent a status or finding; the E2E owner supplies its complete actual output and owns the compiler verdict.
 * @evidence contracts/common.md#meaningful-documentation Continuation lines remain with their banner, including unanchored project findings and Windows source paths.
 * @evidence contracts/performance.md#efficient-algorithms Normalization and banner splitting visit the finite output text in linear passes; no per-scene filtering rescans it.
 */
export function splitEvidenceDiagnostics(output: string): string[] {
  return output
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replaceAll("\\", "/")
    .split(
      /(?=^(?:[^\r\n]*(?:\(\d+,\d+\):|:\d+:\d+\s+-)\s*)?(?:error|warning)\s+TS\d+:)/m,
    );
}
