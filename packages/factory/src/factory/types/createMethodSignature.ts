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
 * Create a {@link MethodSignature}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param questionToken The optional marker (`?`), if any.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The type.
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
