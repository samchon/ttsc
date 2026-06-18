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
 * Create a {@link ClassExpression}: a `class` used as an expression.
 *
 * A string `name` is normalized with {@link asName}; the name is optional, as
 * are the `modifiers`, `typeParameters` and `heritageClauses` (the `extends` /
 * `implements` clauses). The `members` are printed inside the class body.
 *
 * Given name `C` and no members, the printer emits:
 *
 * ```ts
 * class C {}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers, if any.
 * @param name The class name, if any.
 * @param typeParameters The generic type parameters, if any.
 * @param heritageClauses The extends and implements clauses, if any.
 * @param members The class members.
 * @returns The created {@link ClassExpression}.
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
