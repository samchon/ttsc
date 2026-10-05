/**
 * A stray `;` in a class body.
 *
 * Built by {@link factory.createSemicolonClassElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A dedicated kind preserves a real semicolon class member rather than an omitted or missing member.
 * @evidence contracts/common.md#clear-and-simple-design The kind alone suffices because this syntax form has no varying payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Fixed semicolon output is the language form's contract, not a fixture-padding workaround.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the class-body semicolon and constructor; prose/tag separation follows the documentation skill.
 */
export interface SemicolonClassElement {
  /** Discriminant tag; always `"SemicolonClassElement"`. */
  kind: "SemicolonClassElement";
}
