import type { Token } from "../names/Token";
import type { Expression } from "./Expression";

/**
 * A `yield` (or `yield*`) expression.
 *
 * Built by {@link factory.createYieldExpression}.
 *
 * With no operand or marker it represents bare `yield`. Delegating `yield*`
 * requires an operand and a generator context; optional field typing does not
 * enforce those conditions.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Optional operand distinguishes bare from value-bearing yield, and marker presence records delegation; a delegated operand and legal generator context remain caller premises.
 * @evidence contracts/common.md#clear-and-simple-design Two optional constituents capture supported yield forms without generator runtime state or a duplicated iterator representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Delegation is explicit syntax rather than a patched iterator or substituted known yielded result.
 * @evidence contracts/common.md#meaningful-documentation Native prose and members explain bare yield, delegation and context limits, with separate comments and acknowledgment tags under documentation guidance.
 */
export interface YieldExpression {
  /** Discriminant tag; always `"YieldExpression"`. */
  kind: "YieldExpression";

  /**
   * Presence prints delegation `*`; a valid delegated yield also needs an
   * operand.
   */
  asteriskToken?: Token;

  /** Yielded value or delegation source; absent permits bare yield without `*`. */
  expression?: Expression;
}
