/** Object form of {@link ITtscLintFormat.jsDoc}. */
export interface ITtscLintFormatJsDoc {
  /**
   * Extra `from → to` tag rewrites layered on the built-in synonym table
   * (`@return` → `@returns`, `@arg` → `@param`, ...).
   */
  tagSynonyms?: Record<string, string>;

  /**
   * Sort JSDoc tags into canonical order. Reserved; the current MVP only
   * rewrites tag names.
   *
   * @default false
   */
  sortTags?: boolean;
}
