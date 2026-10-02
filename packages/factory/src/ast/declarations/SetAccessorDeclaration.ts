import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { PropertyName } from "../names/PropertyName";
import type { Block } from "../statements/Block";

/**
 * A class setter declaration.
 *
 * Built by {@link factory.createSetAccessorDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation Name, parameter sequence, modifiers and optional body retain setter syntax; the broad sequence does not enforce exactly one legal setter parameter.
 * @evidence contracts/common.md#clear-and-simple-design Shared name/parameter/block nodes expose setter parts without accessor runtime state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This stores setter syntax without replacing foreign setters or injecting test-only assignment behavior.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies class setters and explains parameter-count responsibility and bodyless declarations; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SetAccessorDeclaration {
  /** Discriminant tag; always `"SetAccessorDeclaration"`. */
  kind: "SetAccessorDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: PropertyName;

  /** Printed parameter list; a valid setter requires one suitable parameter. */
  parameters: readonly ParameterDeclaration[];

  /** Setter implementation; absent for a bodyless accessor declaration. */
  body?: Block;
}
