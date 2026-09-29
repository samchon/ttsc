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
 * @evidence contracts/common.md#principled-implementation
 *   Identifier normalization names the enum while ordered members preserve the
 *   implicit-value sequence; const/export choices remain supplied modifiers.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Members own initializers; the declaration owns grouping and modifier context,
 *   leaving numeric enum evaluation to the resulting TypeScript program.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No numeric values or members are fabricated to match an expected enum output.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose describes name normalization, const/export modifiers and member
 *   order, with a separate declaration example before acknowledgment tags.
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
