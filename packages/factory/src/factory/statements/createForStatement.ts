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
 * @evidence contracts/common.md#principled-implementation
 *   Optional initializer, condition and incrementor remain distinct header slots;
 *   absence preserves the corresponding empty position and body order.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Header pieces and body form one loop outline, with child builders owning
 *   declarations/expressions instead of parsing a raw header string.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Omitted conditions remain omitted, not replaced with measured loop limits.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains execution ordering and optional header slots with a for-loop
 *   example separate from acknowledgment tags.
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
