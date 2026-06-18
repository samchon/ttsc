import type { Block, CatchClause, TryStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TryStatement}.
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
