import type {
  ClassDeclaration,
  ClassElement,
  HeritageClause,
  Identifier,
  ModifierLike,
  TypeParameterDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ClassDeclaration}: a `class X { ... }`.
 *
 * The `modifiers` precede the `class` keyword, so an `export` modifier prints
 * `export class`. Any decorators among the modifiers are hoisted onto their own
 * lines above the declaration. The `name` may be omitted for an anonymous class
 * (as in `export default class`), and `typeParameters` add the generic `<...>`
 * list.
 *
 * The `heritageClauses` supply the `extends` and `implements` clauses, printed
 * in supplied order on the header line. The `members` form the body, one per
 * line inside a brace block, collapsing to `{}` when empty.
 *
 * Given an `export` modifier, the name `Circle`, an `extends Base` clause, an
 * `implements IShape` clause, and an `r: number` property, the printed
 * declaration is:
 *
 * ```ts
 * export class Circle extends Base implements IShape {
 *   r: number;
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param typeParameters The generic type parameters, if any.
 * @param heritageClauses The `extends` / `implements` clauses, if any.
 * @param members The members.
 * @returns The created {@link ClassDeclaration}.
 * @evidence contracts/common.md#principled-implementation
 *   Undefined name preserves anonymous-class syntax; strings become Identifier.
 *   Generic parameters, heritage and ordered class members keep distinct slots.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The class header and body share one declaration; child builders own member
 *   syntax and the printer owns decorator placement and brace layout.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Anonymous state is retained rather than inventing a name or base class.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains anonymous/default-export use, decorators, generics and heritage
 *   in separate paragraphs before a class example and acknowledgment tags.
 */
export const createClassDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | Identifier | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  heritageClauses: readonly HeritageClause[] | undefined,
  members: readonly ClassElement[],
): ClassDeclaration =>
  make("ClassDeclaration", {
    modifiers,
    name: name === undefined ? undefined : asName(name),
    typeParameters,
    heritageClauses,
    members,
  });
