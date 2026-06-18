import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * A function/method call, e.g. `fn(a, b)`.
 *
 * Built by {@link factory.createCallExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
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
