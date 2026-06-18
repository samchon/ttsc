import type {
  MethodSignature,
  ModifierLike,
  ParameterDeclaration,
  PropertyName,
  Token,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";

/**
 * Create a {@link MethodSignature}: a `name(params): T` method signature for an
 * interface or type literal.
 *
 * Any modifiers print first, then the name, then a `?` when the question token
 * is present, then optional type parameters as `<...>`, the parameter list, and
 * the return type as `: Type` when present. A string name is normalized to a
 * property name node.
 *
 * Given the name `greet`, one `name: string` parameter, and a `void` return
 * type, the printer renders:
 *
 * ```ts
 * greet(name: string): void
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The method name.
 * @param questionToken The optional marker (`?`), if any.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type, if any.
 * @returns The created {@link MethodSignature}.
 */
export const createMethodSignature = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | PropertyName,
  questionToken: Token | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
): MethodSignature =>
  make("MethodSignature", {
    modifiers,
    name: asPropertyName(name),
    questionToken,
    typeParameters,
    parameters,
    type,
  });
