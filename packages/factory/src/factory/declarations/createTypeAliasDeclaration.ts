import type {
  Identifier,
  ModifierLike,
  TypeAliasDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link TypeAliasDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param typeParameters The generic type parameters, if any.
 * @param type The type.
 * @returns The created {@link TypeAliasDeclaration}.
 */
export const createTypeAliasDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | Identifier,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  type: TypeNode,
): TypeAliasDeclaration =>
  make("TypeAliasDeclaration", {
    modifiers,
    name: asName(name),
    typeParameters,
    type,
  });
