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
 * @evidence contracts/common.md#principled-implementation
 *   The normalized identifier and generic parameters name the alias, while the
 *   supplied TypeNode is retained as its definition rather than resolved to values.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Alias declaration syntax stays separate from type construction and printing;
 *   no symbol table or type checker is introduced for source generation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The definition is caller data, not a fallback type selected to pass a check.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains modifiers, generic parameters and the definition slot,
 *   with a concrete alias example and separate acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
