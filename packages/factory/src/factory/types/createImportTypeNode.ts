import type { EntityName, ImportTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ImportTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param argument The argument.
 * @param qualifier The qualifier.
 * @param typeArguments The typeArguments.
 * @param isTypeOf The isTypeOf.
 * @returns The created node.
 */
export const createImportTypeNode = (
  argument: TypeNode,
  qualifier?: EntityName,
  typeArguments?: readonly TypeNode[],
  isTypeOf: boolean = false,
): ImportTypeNode =>
  make("ImportTypeNode", { argument, qualifier, typeArguments, isTypeOf });
