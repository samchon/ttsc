/**
 * A source location grounding a node or edge in real code: the declaration span
 * for a node, or the expression range that produced an edge. Display and
 * grounding only, never identity (a node's id is position-invariant, see
 * {@link ITtscGraphNode}). Lines and columns are 1-based; MCP keeps evidence as
 * coordinates, so read the file yourself when you truly need source text.
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
