import type {
  Expression,
  ForInitializer,
  ForStatement,
  Statement,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ForStatement}: a C-style `for (init; cond; inc) ...` loop.
 *
 * The `initializer` runs once before the loop (a declaration list or an
 * expression), `condition` is tested before each pass, and `incrementor` runs
 * after each pass; `statement` is the body. Each of the three header parts is
 * optional, so passing `undefined` for all of them yields the infinite `for (;
 * ; )` form.
 *
 * With an `initializer` of `let i = 0`, a `condition` of `i < 10`, an
 * `incrementor` of `i++`, and a `statement` block calling `use(i)`, the result
 * is:
 *
 * ```ts
 * for (let i = 0; i < 10; i++) {
 *   use(i);
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param initializer The initializer.
 * @param condition The condition.
 * @param incrementor The incrementor.
 * @param statement The statement.
 * @returns The created {@link ForStatement}.
 */
export const createForStatement = (
  initializer: ForInitializer | undefined,
  condition: Expression | undefined,
  incrementor: Expression | undefined,
  statement: Statement,
): ForStatement =>
  make("ForStatement", { initializer, condition, incrementor, statement });
