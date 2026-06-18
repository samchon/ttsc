import type {
  ClassElement,
  ClassExpression,
  HeritageClause,
  Identifier,
  ModifierLike,
  TypeParameterDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ClassExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The modifiers.
 * @param name The name.
 * @param typeParameters The typeParameters.
 * @param heritageClauses The heritageClauses.
 * @param members The members.
 * @returns The created node.
 */
export const createClassExpression = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | Identifier | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  heritageClauses: readonly HeritageClause[] | undefined,
  members: readonly ClassElement[],
): ClassExpression =>
  make("ClassExpression", {
    modifiers,
    name: name === undefined ? undefined : asName(name),
    typeParameters,
    heritageClauses,
    members,
  });
