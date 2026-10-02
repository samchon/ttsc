import type { CaseClause, Expression, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CaseClause}: one `case ...:` arm of a switch.
 *
 * The `expression` is the value matched against the switch subject, and
 * `statements` is the body that runs on a match. Fall-through is the default,
 * so include an explicit `break` in `statements` when you want the arm to
 * stop.
 *
 * With `expression` of `1` and `statements` of `a()` followed by a `break`, the
 * result is:
 *
 * ```ts
 * case 1:
 *   a();
 *   break;
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   CaseClause retains its match expression and ordered statements; it does
 *   not insert a break, preserving caller-defined fall-through behavior.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Match and body belong to the arm; switch subject/grouping remain outside it.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No expected match value or termination is synthesized for the supplied arm.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the fall-through consequence and why break must be explicit,
 *   with its example separated from the acknowledgment block.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param statements The statements.
 * @returns The created {@link CaseClause}.
 */
export const createCaseClause = (
  expression: Expression,
  statements: readonly Statement[],
): CaseClause => make("CaseClause", { expression, statements });
