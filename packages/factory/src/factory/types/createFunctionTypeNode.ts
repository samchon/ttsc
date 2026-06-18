import type {
  FunctionTypeNode,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link FunctionTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The type.
 * @returns The created {@link FunctionTypeNode}.
 */
export const createFunctionTypeNode = (
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode,
): FunctionTypeNode =>
  make("FunctionTypeNode", { typeParameters, parameters, type });
