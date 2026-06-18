import type {
  ConstructSignatureDeclaration,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConstructSignature}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The typeParameters.
 * @param parameters The parameters.
 * @param type The type.
 * @returns The created node.
 */
export const createConstructSignature = (
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
): ConstructSignatureDeclaration =>
  make("ConstructSignature", { typeParameters, parameters, type });
