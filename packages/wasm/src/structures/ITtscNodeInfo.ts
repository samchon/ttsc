/** Syntax-token shape returned by `getNodeAtPosition`. */
export interface ITtscNodeInfo {
  /** Numeric `ast.Kind` from TypeScript-Go. */
  kind: number;
  /** Human-readable name of `kind`. */
  kindName: string;
  /** Byte offset where the node begins (inclusive). */
  pos: number;
  /** Byte offset where the node ends (exclusive). */
  end: number;
  /** Source text covered by the node, when available. */
  text?: string;
}
