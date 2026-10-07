import type { Identifier, LabeledStatement, Statement } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link LabeledStatement}: a `label: ...` statement.
 *
 * The `label` names the statement so a `break` or `continue` can target it; a
 * string is wrapped into an identifier. The `statement` is the body the label
 * applies to, typically a loop.
 *
 * With a `label` of `outer` and a `statement` of an empty `for` loop that calls
 * `break outer`, the result is:
 *
 * ```ts
 * outer: for (;;) {
 *   break outer;
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param label The label.
 * @param statement The statement.
 * @returns The created {@link LabeledStatement}.
 * @evidence contracts/common.md#principled-implementation
 *   asName normalizes the label and the Statement remains its target. Correct
 *   break/continue scope and label uniqueness depend on caller context.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The label wrapper owns naming, while its body keeps its original node kind.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Labels are explicit syntax rather than generated routing for unexpected cases.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains targeting and typical loop use with a labeled-break example;
 *   prose, code and acknowledgments are separated as documentation requires.
 */
export const createLabeledStatement = (
  label: string | Identifier,
  statement: Statement,
): LabeledStatement =>
  make("LabeledStatement", { label: asName(label), statement });
