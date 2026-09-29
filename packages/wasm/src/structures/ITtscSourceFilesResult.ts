/**
 * Payload inside `ITtscResult.result` for `getSourceFiles`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A string array carries the native program's source-file keys without making
 *   the JavaScript consumer depend on Go AST objects.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The payload exposes only source identities; source text and semantic queries
 *   remain separate operations instead of inflating every file-list response.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The program supplies file identity; the response does not invent a fixed
 *   entry file or hide files according to a consumer name.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the endpoint, declaration-file exclusion and path convention,
 *   following the documentation skill's usage-context guidance.
 */
export interface ITtscSourceFilesResult {
  /** Non-declaration source paths: project-relative inside cwd, absolute outside. */
  files: string[];
}
