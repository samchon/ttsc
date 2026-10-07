import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * A function/method call, e.g. `fn(a, b)`.
 *
 * Built by {@link factory.createCallExpression}.
 *
 * This is an ordinary call link, not an optional-chain continuation. An empty
 * argument list still prints parentheses; omitted type arguments add no generic
 * syntax. The outline does not resolve or execute the callee.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The callee and ordered arguments represent call syntax independently of evaluation; CallExpression marks an ordinary link, preserving its boundary from optional-chain nodes.
 * @evidence contracts/common.md#clear-and-simple-design Direct callee and argument members expose the call; type arguments are optional syntax rather than a second invocation representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The callee and arguments remain supplied nodes rather than a patched function or a precomputed call result.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes ordinary-link and empty-list behavior; member comments and tags are separated following documentation guidance.
 */
export interface CallExpression {
  /** Discriminant tag; always `"CallExpression"`. */
  kind: "CallExpression";

  /** The expression. */
  expression: Expression;

  /** The generic type arguments, if any. */
  typeArguments?: readonly TypeNode[];

  /** The arguments. */
  arguments: readonly Expression[];
}
