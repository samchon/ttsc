import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { EnumMember } from "./EnumMember";

/**
 * An enum declaration.
 *
 * Built by {@link factory.createEnumDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation Name, optional modifiers and ordered EnumMembers preserve enum declaration syntax without evaluating initializer values or member conflicts.
 * @evidence contracts/common.md#clear-and-simple-design The enum groups its name/header and member sequence while EnumMember owns each initializer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Member values and names are supplied data, without fixture-derived enum results.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies enum syntax and documents member sequence and modifiers; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
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

  /** Enum members in declaration order. */
  members: readonly EnumMember[];
}
