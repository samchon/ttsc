/**
 * A source location that grounds a node or edge in real code — the declaration
 * span for a node, or the expression that produced an edge.
 *
 * Evidence is display and grounding only; it is never identity. A node's id is
 * position-invariant (see {@link ITtscGraphNode}), so an edit that shifts a span
 * does not re-key anything. `startLine`/`startCol` are 1-based. `text` is an
 * optional short excerpt the producer may include so a consumer can show the
 * evidence without a file read.
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

  /** A short source excerpt of the span, when the producer inlines one. */
  text?: string;
}
