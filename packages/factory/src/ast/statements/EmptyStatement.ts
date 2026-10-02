/**
 * An empty statement (a lone `;`).
 *
 * Built by {@link factory.createEmptyStatement}.
 *
 * @evidence contracts/common.md#principled-implementation A distinct kind preserves a real semicolon statement, unlike a non-emitted placeholder that contributes no syntax.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only form needs no text field because its syntax is fixed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The semicolon defines the published statement form rather than a fixture workaround.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explicitly identifies the lone semicolon and constructor; prose/tag separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface EmptyStatement {
  /** Discriminant tag; always `"EmptyStatement"`. */
  kind: "EmptyStatement";
}
