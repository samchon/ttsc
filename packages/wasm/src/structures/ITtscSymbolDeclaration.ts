/**
 * A single declaration site for a symbol.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Nullable file identity and byte ranges preserve the native AST declaration
 *   projection, including declarations without an associated source file.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Source identity and a byte interval are sufficient for a declaration site;
 *   this value contains no redundant source text or compiler object references.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A missing source file remains null; neither a placeholder filename nor a
 *   guessed JavaScript character range is inserted into the declaration.
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc explains path provenance and interval units, following the
 *   documentation skill's guidance for absent state and coordinates.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscSymbolDeclaration is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscSymbolDeclaration is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscSymbolDeclaration is a data interface and coordinates no shared or repeated computation.
 */
export interface ITtscSymbolDeclaration {
  /** Project-relative or absolute path; null when no source file is associated. */
  file: string | null;

  /** Inclusive start offset of the declaration's first token in the source's UTF-8 bytes, after leading whitespace, comments and JSDoc. */
  pos: number;

  /** Exclusive end offset in the source's UTF-8 bytes. */
  end: number;
}
