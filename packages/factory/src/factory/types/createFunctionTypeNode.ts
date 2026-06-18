import type {
  FunctionTypeNode,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link FunctionTypeNode}: a `(params) => T` function type.
 *
 * Optional type parameters print first as `<...>`, then the parameter list,
 * then `=>` followed by the return type. In postfix and array positions the
 * surrounding printer wraps a function type in parentheses, since `() => T[]`
 * would otherwise read as an array of the return type.
 *
 * Given one `x: number` parameter and a `string` return type, the printer
 * renders:
 *
 * ```ts
 * (x: number) => string;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type.
 * @returns The created {@link FunctionTypeNode}.
 */
export const createFunctionTypeNode = (
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode,
): FunctionTypeNode =>
  make("FunctionTypeNode", { typeParameters, parameters, type });
