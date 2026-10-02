import type { Statement } from "./Statement";

/**
 * The `default` clause of a `switch`.
 *
 * Built by {@link factory.createDefaultClause}.
 *
 * @evidence contracts/common.md#principled-implementation The default kind carries an ordered statement body without a case expression; uniqueness within a switch is not enforced by this shape.
 * @evidence contracts/common.md#clear-and-simple-design A single body sequence represents the clause while its enclosing CaseBlock owns ordering.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default discriminant is syntax rather than a hardcoded fallback answer for consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the default clause and body sequence; native separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface DefaultClause {
  /** Discriminant tag; always `"DefaultClause"`. */
  kind: "DefaultClause";

  /** Default clause body in printed order. */
  statements: readonly Statement[];
}
