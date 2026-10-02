import type { Block } from "./Block";
import type { CatchClause } from "./CatchClause";

/**
 * A `try` / `catch` / `finally` statement.
 *
 * Built by {@link factory.createTryStatement}.
 *
 * A valid try statement requires catch or finally. Both are optional in the
 * shape so callers must establish that at least one is present.
 *
 * @evidence contracts/common.md#principled-implementation Required try body and optional catch/finally clauses retain source parts; the representation does not enforce the required presence of at least one handler or cleanup clause.
 * @evidence contracts/common.md#clear-and-simple-design Three named clauses separate guarded code, handler and cleanup without runtime execution state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Handler syntax is supplied data rather than a production workaround that swallows errors.
 * @evidence contracts/common.md#meaningful-documentation JSDoc records the catch/finally requirement and labels absent clauses; separate paragraphs follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TryStatement {
  /** Discriminant tag; always `"TryStatement"`. */
  kind: "TryStatement";

  /** Guarded statement body following try. */
  tryBlock: Block;

  /** Exception handler; absent when only finally is supplied. */
  catchClause?: CatchClause;

  /** Cleanup clause; absent when only catch is supplied. */
  finallyBlock?: Block;
}
