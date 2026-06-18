import type {
  CallSignatureDeclaration,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CallSignature}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The typeParameters.
 * @param parameters The parameters.
 * @param type The type.
 * @returns The created node.
 */
export const createCallSignature = (
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
): CallSignatureDeclaration =>
  make("CallSignature", { typeParameters, parameters, type });
