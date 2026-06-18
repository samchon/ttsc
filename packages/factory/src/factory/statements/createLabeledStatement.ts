import type { Identifier, LabeledStatement, Statement } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link LabeledStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param label The label.
 * @param statement The statement.
 * @returns The created {@link LabeledStatement}.
 */
export const createLabeledStatement = (
  label: string | Identifier,
  statement: Statement,
): LabeledStatement =>
  make("LabeledStatement", { label: asName(label), statement });
