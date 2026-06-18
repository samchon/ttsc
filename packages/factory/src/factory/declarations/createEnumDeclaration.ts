import type {
  EnumDeclaration,
  EnumMember,
  Identifier,
  ModifierLike,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link EnumDeclaration}.
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
