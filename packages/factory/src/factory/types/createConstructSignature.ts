import type {
  ConstructSignatureDeclaration,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConstructSignature}: a `new (params): T` construct signature
 * for an interface or type literal.
 *
 * The `new ` keyword prints first, then optional type parameters as `<...>`,
 * the parameter list, and the return type as `: Type` when present.
 *
 * Given one `x: number` parameter and a `Foo` return type, the printer renders:
 *
 * ```ts
 * new (x: number): Foo
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type, if any.
 * @returns The created {@link ConstructSignature}.
 */
export const createConstructSignature = (
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
): ConstructSignatureDeclaration =>
  make("ConstructSignature", { typeParameters, parameters, type });
