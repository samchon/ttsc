import type { EmptyStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link EmptyStatement}: a lone `;` statement.
 *
 * The statement takes no inputs and does nothing. It is the empty body you
 * reach for when a loop or branch needs a statement but no work, such as `for
 * (; cond; );`.
 *
 * The result is a single semicolon:
 *
 * ```ts
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link EmptyStatement}.
 */
export const createEmptyStatement = (): EmptyStatement =>
  make("EmptyStatement", {});
