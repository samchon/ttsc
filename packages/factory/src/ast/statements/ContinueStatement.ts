import type { Identifier } from "../names/Identifier";

/**
 * A `continue` statement, optionally labeled.
 *
 * Built by {@link factory.createContinueStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Optional label distinguishes labeled and unlabeled continue syntax; existence of a loop target remains a checking concern.
 * @evidence contracts/common.md#clear-and-simple-design One optional Identifier exposes the only variable syntax part without binding state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Labels come from callers, without special loop names for tests or consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains labeled continuation and absent labels; native member separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ContinueStatement {
  /** Discriminant tag; always `"ContinueStatement"`. */
  kind: "ContinueStatement";

  /** Enclosing loop label; omitted to continue the nearest enclosing loop. */
  label?: Identifier;
}
