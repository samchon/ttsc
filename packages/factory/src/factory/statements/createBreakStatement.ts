import type { BreakStatement, Identifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link BreakStatement}.
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
