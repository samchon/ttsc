import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeNode } from "./TypeNode";

/**
 * A generic type parameter declaration, e.g. `<T extends U = D>`.
 *
 * Built by {@link factory.createTypeParameterDeclaration}.
 *
 * @evidence contracts/common.md#principled-implementation Identifier plus optional constraint/default/modifiers represents generic parameter clauses; omission means absent syntax rather than evaluated type inference.
 * @evidence contracts/common.md#clear-and-simple-design Constraint and default have separate fields, sharing TypeNode instead of combining generic policy into flags.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Names and bounds are caller data, with no fixture-specific generic defaults.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates constraint/default syntax and documents absent clauses; member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeParameterDeclaration {
  /** Discriminant tag; always `"TypeParameterDeclaration"`. */
  kind: "TypeParameterDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: Identifier;

  /** The `extends` constraint, if any. */
  constraint?: TypeNode;

  /** The default type, if any. */
  default?: TypeNode;
}
