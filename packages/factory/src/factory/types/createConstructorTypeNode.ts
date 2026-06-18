import type {
  ConstructorTypeNode,
  Modifier,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConstructorTypeNode}: a `new (params) => T` constructor type.
 *
 * Any modifiers print first (for example `abstract`), then the `new ` keyword,
 * then optional type parameters as `<...>`, the parameter list, and finally
 * `=>` followed by the return type.
 *
 * Given no modifiers, one `x: number` parameter, and a `Foo` return type, the
 * printer renders:
 *
 * ```ts
 * new (x: number) => Foo
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers, if any.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type.
 * @returns The created {@link ConstructorTypeNode}.
 */
export const createConstructorTypeNode = (
  modifiers: readonly Modifier[] | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode,
): ConstructorTypeNode =>
  make("ConstructorTypeNode", { modifiers, typeParameters, parameters, type });
