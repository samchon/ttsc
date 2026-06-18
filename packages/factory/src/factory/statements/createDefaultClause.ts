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
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @returns The created {@link DefaultClause}.
 */
export const createDefaultClause = (
  statements: readonly Statement[],
): DefaultClause => make("DefaultClause", { statements });
