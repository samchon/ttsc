import type {
  Expression,
  ForInitializer,
  ForOfStatement,
  Statement,
  Token,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ForOfStatement}: a `for (... of ...)` loop.
 *
 * The `initializer` is the binding that receives each element, `expression` is
 * the iterable being walked, and `statement` is the loop body. Pass an `await`
 * token as `awaitModifier` to emit `for await (...)` for async iterables, or
 * `undefined` for the plain form.
 *
 * With `awaitModifier` of `undefined`, an `initializer` of `const item`, an
 * `expression` of `list`, and a `statement` block calling `use(item)`, the
 * result is:
 *
 * ```ts
 * for (const item of list) {
 *   use(item);
 * }
 * ```
 *
 * Passing an `await` token as `awaitModifier` instead yields:
 *
 * ```ts
 * for await (const item of list) {
 *   use(item);
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param awaitModifier The await marker for asynchronous iteration, if any.
 * @param initializer The initializer.
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link ForOfStatement}.
 * @evidence contracts/common.md#principled-implementation
 *   Binding, iterable and body preserve value-iteration syntax. Optional await
 *   distinguishes asynchronous iteration; callers supply a valid await token/context.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One explicit modifier represents the async form instead of a second loop
 *   builder or implicit promise-processing layer.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Iteration is not lowered to indexed access or fabricated await results.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains iterable values and the await distinction, with plain
 *   and async examples in separate paragraphs before acknowledgment tags.
 */
export const createForOfStatement = (
  awaitModifier: Token | undefined,
  initializer: ForInitializer,
  expression: Expression,
  statement: Statement,
): ForOfStatement =>
  make("ForOfStatement", { awaitModifier, initializer, expression, statement });
