import type { DefaultClause, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link DefaultClause}: the `default:` arm of a switch.
 *
 * The `statements` form the body that runs when no `case` matches. As with
 * `case` arms, fall-through is the default, so add an explicit `break` when the
 * arm should stop.
 *
 * With `statements` of a single `b()` call, the result is:
 *
 * ```ts
 * default:
 *   b();
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   DefaultClause has ordered statements and no match expression, distinguishing
 *   the fallback arm while preserving explicit fall-through/break decisions.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The arm owns its body only; CaseBlock and SwitchStatement own placement/subject.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A default arm is explicit syntax, not a fabricated successful case result.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states the no-match meaning and termination responsibility,
 *   with a separate default-arm example before acknowledgment tags.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @returns The created {@link DefaultClause}.
 */
export const createDefaultClause = (
  statements: readonly Statement[],
): DefaultClause => make("DefaultClause", { statements });
