import type {
  CallSignatureDeclaration,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CallSignature}: a `(params): ReturnType` call signature for an
 * interface or type literal.
 *
 * Optional type parameters print first as `<...>`, then the parameter list,
 * then the return type as `: Type` when present.
 *
 * Given one `x: number` parameter and a `string` return type, the printer
 * renders:
 *
 * ```ts
 * (x: number): string
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type, if any.
 * @returns The created {@link CallSignature}.
 */
export const createCallSignature = (
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
): CallSignatureDeclaration =>
  make("CallSignature", { typeParameters, parameters, type });
