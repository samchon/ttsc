import type { ContinueStatement, Identifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ContinueStatement}: a `continue;` statement.
 *
 * The optional `label` names an enclosing labeled loop to continue. A string is
 * wrapped into an identifier; pass nothing for a plain `continue`.
 *
 * With no label the result is:
 *
 * ```ts
 * continue;
 * ```
 *
 * With `label` of `outer` the result is:
 *
 * ```ts
 * continue outer;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param label The label.
 * @returns The created {@link ContinueStatement}.
 */
export const createContinueStatement = (
  label?: string | Identifier,
): ContinueStatement =>
  make("ContinueStatement", {
    label: label === undefined ? undefined : asName(label),
  });
