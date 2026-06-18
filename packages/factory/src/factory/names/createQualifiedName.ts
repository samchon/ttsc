import type { EntityName, Identifier, QualifiedName } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link QualifiedName}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link QualifiedName}.
 */
export const createQualifiedName = (
  left: EntityName,
  right: string | Identifier,
): QualifiedName =>
  make("QualifiedName", { left, right: asName(right) as Identifier });
