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
 * @param tryBlock The guarded body.
 * @param catchClause The optional exception handler.
 * @param finallyBlock The optional finalizer body.
 * @returns The created {@link TryStatement}.
 * @evidence contracts/common.md#principled-implementation
 *   Guarded, handler and finalizer subtrees retain their order and optionality.
 *   The broad shape relies on the caller to supply catch or finally for valid syntax.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Try owns composition while CatchClause and Block own bindings/statements;
 *   construction introduces no actual exception-handling execution.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The supplied handler is syntax, not a wrapper hiding a factory failure.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states the at-least-one-handler/finalizer constraint with
 *   a complete example and separate acknowledgment paragraphs.
 */
export const createTryStatement = (
  tryBlock: Block,
  catchClause: CatchClause | undefined,
  finallyBlock: Block | undefined,
): TryStatement =>
  make("TryStatement", { tryBlock, catchClause, finallyBlock });
