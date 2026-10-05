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
 * Create an {@link InterfaceDeclaration}: an `interface X { ... }`.
 *
 * The `modifiers` are printed in front of the `interface` keyword, so passing
 * an `export` modifier yields `export interface`. The `name` accepts a plain
 * string or a prebuilt identifier, and `typeParameters` add the `<...>` generic
 * list when present. The `heritageClauses` carry the `extends` clauses, while
 * `members` become the body. The printer wraps the members in a brace block,
 * one member per line, and emits an empty `{}` when there are none.
 *
 * Given an `export` modifier, the name `IBox`, and a single `value: number`
 * member, the printed declaration is:
 *
 * ```ts
 * export interface IBox {
 *   value: number;
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param typeParameters The generic type parameters, if any.
 * @param heritageClauses The `extends` / `implements` clauses, if any.
 * @param members The members.
 * @returns The created {@link InterfaceDeclaration}.
 * @evidence contracts/common.md#principled-implementation
 *   InterfaceDeclaration retains its normalized name, generics, heritage and
 *   ordered TypeElement members; callers choose interface-valid heritage clauses.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Header and member grouping belong to the declaration, while individual
 *   signatures/properties and brace formatting keep their existing owners.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Empty members stay an empty interface rather than generated compatibility fields.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains generics, extends and empty member blocks with a concrete
 *   interface example separated from tags under documentation guidance.
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
