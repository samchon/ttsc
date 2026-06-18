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
 * Create a {@link TypeAliasDeclaration}: a `type X = ...;`.
 *
 * The `modifiers` precede the `type` keyword, so an `export` modifier prints
 * `export type`. The `name` accepts a string or identifier, and
 * `typeParameters` add the generic `<...>` list when present. The `type` is the
 * aliased type printed after the `=`, and the printer terminates the statement
 * with a semicolon.
 *
 * Given an `export` modifier, the name `ID`, and a `string` type, the printed
 * declaration is:
 *
 * ```ts
 * export type ID = string;
 * ```
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
