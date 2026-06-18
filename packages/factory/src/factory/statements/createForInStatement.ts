import type {
  Expression,
  ForInStatement,
  ForInitializer,
  Statement,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ForInStatement}: a `for (... in ...)` loop.
 *
 * The `initializer` is the binding that receives each enumerable key (a
 * declaration list such as `const key`, or an assignment target), `expression`
 * is the object being enumerated, and `statement` is the loop body. The loop
 * walks the object's enumerable property keys as strings.
 *
 * With an `initializer` of `const key`, an `expression` of `obj`, and a
 * `statement` block calling `use(key)`, the result is:
 *
 * ```ts
 * for (const key in obj) {
 *   use(key);
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param initializer The initializer.
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link ForInStatement}.
 */
export const createForInStatement = (
  initializer: ForInitializer,
  expression: Expression,
  statement: Statement,
): ForInStatement =>
  make("ForInStatement", { initializer, expression, statement });
