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
 * @author Jeongho Nam - https://github.com/samchon
 * @param clauses The clauses.
 * @returns The created {@link CaseBlock}.
 */
export const createCaseBlock = (
  clauses: readonly CaseOrDefaultClause[],
): CaseBlock => make("CaseBlock", { clauses });
