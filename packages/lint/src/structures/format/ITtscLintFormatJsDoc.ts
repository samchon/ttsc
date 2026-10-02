/**
 * Object form of {@link ITtscLintFormat.jsDoc}.
 *
 * @evidence contracts/common.md#principled-implementation Optional tag substitutions and the reserved sort flag represent the formatter's supported JSDoc options without claiming sorting is implemented.
 * @evidence contracts/common.md#clear-and-simple-design Two independent options stay in one JSDoc configuration record rather than expanding the top-level formatter schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts User-declared synonyms extend a supported table instead of patching a parser or handling particular fixtures.
 * @evidence contracts/common.md#meaningful-documentation Member prose explains synonym layering and the unimplemented sort flag with its default; member and tag spacing follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFormatJsDoc is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFormatJsDoc is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFormatJsDoc is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFormatJsDoc is a declaration of data shape; the code that holds its values owns their lifetime.
 */
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
