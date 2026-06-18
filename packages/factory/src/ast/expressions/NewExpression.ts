import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * A constructor call, e.g. `new Foo()`.
 *
 * Built by {@link factory.createNewExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NewExpression {
  /** Discriminant tag; always `"NewExpression"`. */
  kind: "NewExpression";

  /** The expression. */
  expression: Expression;

  /** The generic type arguments, if any. */
  typeArguments?: readonly TypeNode[];

  /** The arguments. */
  arguments?: readonly Expression[];
}
