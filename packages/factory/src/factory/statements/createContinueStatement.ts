import type { ContinueStatement, Identifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ContinueStatement}.
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
