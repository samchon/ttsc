import type {
  HeritageClause,
  Identifier,
  InterfaceDeclaration,
  ModifierLike,
  TypeElement,
  TypeParameterDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link InterfaceDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param typeParameters The generic type parameters, if any.
 * @param heritageClauses The `extends` / `implements` clauses, if any.
 * @param members The members.
 * @returns The created {@link InterfaceDeclaration}.
 */
export const createInterfaceDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | Identifier,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  heritageClauses: readonly HeritageClause[] | undefined,
  members: readonly TypeElement[],
): InterfaceDeclaration =>
  make("InterfaceDeclaration", {
    modifiers,
    name: asName(name),
    typeParameters,
    heritageClauses,
    members,
  });
