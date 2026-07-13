/**
 * A span on the wire, without the file it lives in.
 *
 * The reader already knows the file: a node's span is in the node's `file`, and
 * an edge's span is in the file its `from` id names. Sending the path a second
 * and a third time cost 17% of the document — on VS Code, 55 MB of a 323 MB
 * dump that then has to be encoded, piped, parsed and validated — for a value
 * that is reconstructible exactly.
 *
 * {@link TtscGraphMemory} puts the file back before any of it is read, so what
 * the graph engine and the MCP results see is the whole
 * {@link ITtscGraphEvidence}. This shape exists only between the Go builder and
 * the loader.
 */
export interface ITtscGraphSpan {
  /**
   * Present only when it cannot be derived: an `implementation` can live in a
   * different file from the declaration that owns it.
   */
  file?: string;

  /** 1-based line where the span starts. */
  startLine: number;

  /** 1-based column where the span starts, when known. */
  startCol?: number;

  /** 1-based line where the span ends, when known. */
  endLine?: number;

  /** 1-based column where the span ends, when known. */
  endCol?: number;
}
