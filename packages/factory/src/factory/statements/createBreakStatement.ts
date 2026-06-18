import type { BreakStatement, Identifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link BreakStatement}: a `break;` statement.
 *
 * The optional `label` names an enclosing labeled statement to break out of. A
 * string is wrapped into an identifier; pass nothing for a plain `break`.
 *
 * With no label the result is:
 *
 * ```ts
 * break;
 * ```
 *
 * With `label` of `outer` the result is:
 *
 * ```ts
 * break outer;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param label The label.
 * @returns The created {@link BreakStatement}.
 */
export const createBreakStatement = (
  label?: string | Identifier,
): BreakStatement =>
  make("BreakStatement", {
    label: label === undefined ? undefined : asName(label),
  });
