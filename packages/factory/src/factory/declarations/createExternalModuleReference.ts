import type { Expression, ExternalModuleReference } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ExternalModuleReference}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ExternalModuleReference}.
 */
export const createExternalModuleReference = (
  expression: Expression,
): ExternalModuleReference => make("ExternalModuleReference", { expression });
