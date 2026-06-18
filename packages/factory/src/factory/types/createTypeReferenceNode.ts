import type { EntityName, TypeNode, TypeReferenceNode } from "../../ast";
import { asEntityName } from "../internal/asEntityName";
import { make } from "../internal/make";

/**
 * Create a {@link TypeReferenceNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeName The referenced type name.
 * @param typeArguments The generic type arguments, if any.
 * @returns The created {@link TypeReferenceNode}.
 */
export const createTypeReferenceNode = (
  typeName: string | EntityName,
  typeArguments?: readonly TypeNode[],
): TypeReferenceNode =>
  make("TypeReferenceNode", {
    typeName: asEntityName(typeName),
    typeArguments,
  });
