import type { Block } from "./Block";
import type { CatchClause } from "./CatchClause";

/**
 * A `try` / `catch` / `finally` statement.
 *
 * Built by {@link factory.createTryStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TryStatement {
  /** Discriminant tag; always `"TryStatement"`. */
  kind: "TryStatement";

  /** TryBlock. */
  tryBlock: Block;

  /** CatchClause. */
  catchClause?: CatchClause;

  /** FinallyBlock. */
  finallyBlock?: Block;
}
