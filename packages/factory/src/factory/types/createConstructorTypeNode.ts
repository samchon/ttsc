import type {
  ConstructorTypeNode,
  Modifier,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConstructorTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The modifiers.
 * @param typeParameters The typeParameters.
 * @param parameters The parameters.
 * @param type The type.
 * @returns The created node.
 */
export const createConstructorTypeNode = (
  modifiers: readonly Modifier[] | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode,
): ConstructorTypeNode =>
  make("ConstructorTypeNode", { modifiers, typeParameters, parameters, type });
