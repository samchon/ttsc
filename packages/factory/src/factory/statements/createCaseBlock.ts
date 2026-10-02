import type { CaseBlock, CaseOrDefaultClause } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CaseBlock}: the braced body of a switch statement.
 *
 * The `clauses` are the `case` and `default` arms, printed in the given order
 * between braces. This is the body you hand to {@link createSwitchStatement}; on
 * its own it carries no switch subject.
 *
 * With `clauses` of a `case 1:` arm (calling `a()` then `break`) and a
 * `default:` arm (calling `b()`), the result is:
 *
 * ```ts
 * {
 *   case 1:
 *     a();
 *     break;
 *   default:
 *     b();
 * }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Ordered case/default clauses retain switch arm ordering and possible
 *   fall-through; the switch subject is represented by its parent node.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The block owns clause grouping while each arm owns its expression/statements.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Clause order is preserved without injected default cases or breaks.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc identifies the switch-body boundary and absent subject, with
 *   a multi-arm example and separated acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param clauses The clauses.
 * @returns The created {@link CaseBlock}.
 */
export const createCaseBlock = (
  clauses: readonly CaseOrDefaultClause[],
): CaseBlock => make("CaseBlock", { clauses });
