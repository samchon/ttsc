import type {
  EnumDeclaration,
  EnumMember,
  Identifier,
  ModifierLike,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create an {@link EnumDeclaration}: an `enum X { ... }`.
 *
 * The `modifiers` precede the `enum` keyword, so an `export` modifier prints
 * `export enum`, and a `const` modifier prints `const enum`. The `name` accepts
 * a string or identifier. The `members` form the body, printed one per line and
 * each terminated with a trailing comma.
 *
 * Given an `export` modifier, the name `Color`, and the members `Red` and
 * `Green`, the printed declaration is:
 *
 * ```ts
 * export enum Color {
 *   Red,
 *   Green,
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param members The members.
 * @returns The created {@link EnumDeclaration}.
 */
export const createEnumDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | Identifier,
  members: readonly EnumMember[],
): EnumDeclaration =>
  make("EnumDeclaration", { modifiers, name: asName(name), members });
