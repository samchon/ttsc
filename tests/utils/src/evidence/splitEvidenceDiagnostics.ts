/**
 * Separates compiler diagnostic banners while retaining their continuation
 * text.
 *
 * ANSI SGR escapes are removed and every backslash becomes a slash, including
 * backslashes in continuation text. Splitting preserves input order and
 * duplicate chunks; a prefix before the first banner may remain its own chunk.
 *
 * @evidence contracts/common.md#principled-implementation Authored compiler text is normalized and split at plain or source-qualified diagnostic banners; project findings and duplicate chunks remain visible.
 * @evidence contracts/common.md#clear-and-simple-design One pure string operation serves both consumer assertions and its direct unit without copied implementations or a compiler-shaped response.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Splitting cannot invent a status or finding; the E2E owner supplies its complete actual output and owns the compiler verdict.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies SGR removal, whole-text slash normalization, continuation ownership, duplicate preservation and the possible prefix chunk.
 * @evidence contracts/performance.md#efficient-algorithms Fixed-pattern normalization and banner splitting make linear passes over input text; intermediate normalized strings and returned chunk storage grow with output length. No per-scene filtering rescans it.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation normalizes renderer text only; replacing backslashes is diagnostic spelling normalization, not native filesystem identity.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each supplied output is split anew; mutable native process results are not cached.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Call-local strings and chunks transfer to the caller and no handle or retained state is acquired.
 */
export function splitEvidenceDiagnostics(output: string): string[] {
  return output
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replaceAll("\\", "/")
    .split(
      /(?=^(?:[^\r\n]*(?:\(\d+,\d+\):|:\d+:\d+\s+-)\s*)?(?:error|warning)\s+TS\d+:)/m,
    );
}
