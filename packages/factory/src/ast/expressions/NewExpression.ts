import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * A constructor call, e.g. `new Foo()`.
 *
 * Built by {@link factory.createNewExpression}.
 *
 * Missing arguments and an empty list both print `()`. The outline does not
 * check constructibility or preserve the source distinction between `new C`
 * and `new C()`.
 *
 * @evidence contracts/common.md#principled-implementation Constructor target, type arguments and value arguments retain the new-expression constituents; absent arguments normalize to empty parentheses during printing, and constructibility is not established by this type.
 * @evidence contracts/common.md#clear-and-simple-design One target and two optional ordered lists expose the construction syntax without instance state or a separate call wrapper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The target remains caller-supplied syntax instead of an injected constructor or a preselected object result.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies parentheses normalization and constructibility limits; the arguments member states omission behavior with separate comments and tags.
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

  /** Constructor arguments; absent and empty both print an empty `()` list. */
  arguments?: readonly Expression[];
}
