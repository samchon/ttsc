import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { EnumMember } from "./EnumMember";

/**
 * An enum declaration.
 *
 * Built by {@link factory.createEnumDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface EnumDeclaration {
  /** Discriminant tag; always `"EnumDeclaration"`. */
  kind: "EnumDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: Identifier;

  /** The members. */
  members: readonly EnumMember[];
}
