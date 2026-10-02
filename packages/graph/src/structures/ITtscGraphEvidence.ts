/**
 * A source location grounding a node or edge in real code: the declaration span
 * for a node, or the expression range that produced an edge. Display and
 * grounding only, never identity (a node's id is position-invariant, see
 * {@link ITtscGraphNode}). Lines and columns are 1-based; MCP keeps evidence as
 * coordinates, so read the file yourself when you truly need source text.
 *
 * @evidence contracts/common.md#principled-implementation File plus one-based coordinates identify a source location while optional end coordinates express incomplete ranges.
 * @evidence contracts/common.md#clear-and-simple-design The record carries coordinates only; node identity and source content remain outside this responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Positions are display evidence, never a substitute for stable symbol identity.
 * @evidence contracts/common.md#meaningful-documentation Native comments explicitly state coordinate units, optional endpoints and the distinction between grounding and identity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface ITtscGraphEvidence {
  /** Project-relative path of the file the span lives in. */
  file: string;

  /** 1-based line where the span starts. */
  startLine: number;

  /** 1-based column where the span starts, when known. */
  startCol?: number;

  /** 1-based line where the span ends, when it differs from `startLine`. */
  endLine?: number;

  /** 1-based column where the span ends, when known. */
  endCol?: number;
}
