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
 *
 * @evidence contracts/common.md#principled-implementation One-based coordinates and an optional non-derivable file preserve exact wire spans with reconstructible ordinary paths omitted.
 * @evidence contracts/common.md#clear-and-simple-design The compact wire shape stays separate from the fully qualified memory evidence shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cross-file implementations retain their explicit file instead of being forced into the owner's path.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain reconstruction ownership and member comments state coordinate units and file absence semantics.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphSpan declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphSpan declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphSpan declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphSpan declares a data shape or groups members and performs no filesystem, path or process operation.
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
