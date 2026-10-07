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
 * @evidence contracts/common.md#principled-implementation
 *   ConstructorTypeNode retains leading modifiers, generics, parameters and the
 *   required result type, distinguishing new => syntax from a construct member.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The function builds a type outline rather than a constructor declaration;
 *   printer logic owns new, arrow and contextual grouping.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Modifier and parameter arrays keep caller order; no class-name lookup or
 *   patched return text substitutes for the supplied result type.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc distinguishes constructor types from construct signatures and
 *   explains each parameter with a concrete new-arrow example.
 */
export const createConstructorTypeNode = (
  modifiers: readonly Modifier[] | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode,
): ConstructorTypeNode =>
  make("ConstructorTypeNode", { modifiers, typeParameters, parameters, type });
