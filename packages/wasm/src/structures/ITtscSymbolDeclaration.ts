/** A single declaration site for a symbol. */
export interface ITtscSymbolDeclaration {
  /** Project-relative or absolute path; `null` for synthetic declarations. */
  file: string | null;
  pos: number;
  end: number;
}
