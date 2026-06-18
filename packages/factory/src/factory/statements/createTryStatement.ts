import type { Block, CatchClause, TryStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TryStatement}: a `try { ... } catch { ... } finally { ... }`
 * statement.
 *
 * The `tryBlock` is the guarded body. The `catchClause` and `finallyBlock` are
 * both optional, but at least one must be present for valid TypeScript: pass
 * `undefined` for `catchClause` to emit a `try`/`finally`, or `undefined` for
 * `finallyBlock` to emit a `try`/`catch`.
 *
 * With a `tryBlock` calling `risky()`, a `catchClause` binding `e` and calling
 * `handle(e)`, and a `finallyBlock` calling `cleanup()`, the result is:
 *
 * ```ts
 * try {
 *   risky();
 * } catch (e) {
 *   handle(e);
 * } finally {
 *   cleanup();
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tryBlock The tryBlock.
 * @param catchClause The catchClause.
 * @param finallyBlock The finallyBlock.
 * @returns The created {@link TryStatement}.
 */
export const createTryStatement = (
  tryBlock: Block,
  catchClause: CatchClause | undefined,
  finallyBlock: Block | undefined,
): TryStatement =>
  make("TryStatement", { tryBlock, catchClause, finallyBlock });
