/**
 * The VS Code RelativePattern constructor accepting a literal base and a
 * glob beneath it.
 *
 * The base must stay literal even when a workspace directory contains glob
 * metacharacters.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The constructor signature preserves separate literal-base and glob
 *   arguments and its generic result, matching VS Code RelativePattern without
 *   making the resolver import the editor runtime.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Constructor injection is the narrow boundary needed by pattern creation;
 *   a separate factory framework or editor dependency is unnecessary.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the literal native base and separate glob, explaining
 *   why workspace metacharacters must remain literal. Purpose, conditions and
 *   reasons use separate native paragraphs under the documentation skill;
 *   member comments remain beside their fields.
 */
export type RelativePatternConstructor<T> = new (
  base: string,
  pattern: string,
) => T;
