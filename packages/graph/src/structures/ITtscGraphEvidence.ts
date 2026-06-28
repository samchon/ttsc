/**
 * A source location that grounds a node or edge in real code: the declaration
 * span for a node, or the expression range that produced an edge.
 *
 * Evidence is display and grounding only; it is never identity. A node's id is
 * position-invariant (see {@link ITtscGraphNode}), so an edit that shifts a span
 * does not re-key anything. `startLine`/`startCol` are 1-based. MCP output
 * keeps evidence as coordinates; consumers can read the file themselves when
 * they truly need source text.
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
