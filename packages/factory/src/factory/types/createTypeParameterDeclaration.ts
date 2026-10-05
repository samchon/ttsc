import type {
  Identifier,
  ModifierLike,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link TypeParameterDeclaration}: a generic parameter such as `T
 * extends string = string`.
 *
 * Any modifiers print first (for example `const`, `in`, `out`), then the name.
 * A constraint adds ` extends Type` and a default adds ` = Type`, each only
 * when present. A string name is normalized to an identifier.
 *
 * Given the name `T`, a `string` constraint, and a `string` default, the
 * printer renders:
 *
 * ```ts
 * T extends string = string
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The parameter name.
 * @param constraint The `extends` constraint, if any.
 * @param defaultType The default type, if any.
 * @returns The created {@link TypeParameterDeclaration}.
 * @evidence contracts/common.md#principled-implementation
 *   The identifier, constraint and default remain distinct generic-parameter
 *   fields; defaultType maps to the AST's default field without evaluating constraint satisfaction.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Shared identifier conversion owns string normalization, while the single
 *   declaration retains modifiers and both optional type clauses.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Parameter names do not select hidden bounds or defaults. Supplied clauses
 *   are preserved instead of repaired with expected types.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose distinguishes constraint from default; the example now uses
 *   a default satisfying its stated constraint rather than an invalid teaching example.
 */
export const createTypeParameterDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | Identifier,
  constraint?: TypeNode,
  defaultType?: TypeNode,
): TypeParameterDeclaration =>
  make("TypeParameterDeclaration", {
    modifiers,
    name: asName(name),
    constraint,
    default: defaultType,
  });
