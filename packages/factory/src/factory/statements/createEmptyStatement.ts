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
 * ;
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   EmptyStatement encodes a lone semicolon, which is a valid empty body where
 *   grammar requires a Statement. It does not remove an existing statement.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The discriminant alone supplies meaning; no placeholder name/body is needed.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   An explicit empty body differs from silently discarding caller statements.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc gives the no-op meaning and loop-body use, separated from tags under
 *   the documentation skill's paragraph guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link EmptyStatement}.
 */
export const createEmptyStatement = (): EmptyStatement =>
  make("EmptyStatement", {});
