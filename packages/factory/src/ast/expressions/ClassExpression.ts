import type { HeritageClause } from "../clauses/HeritageClause";
import type { ClassElement } from "../declarations/ClassElement";
import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";

/**
 * A class expression.
 *
 * Built by {@link factory.createClassExpression}.
 *
 * An absent name represents an anonymous class. Members remain in source
 * order; this outline does not validate modifier or heritage combinations.
 *
 * @evidence contracts/common.md#principled-implementation Optional naming distinguishes anonymous and named class expressions, while ordered members and heritage clauses preserve the supplied class outline; validity of combinations remains caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design Header constituents and body members are separate direct fields, reusing class element types without declaration-only state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Anonymous classes remain unnamed instead of acquiring invented identifiers or consumer-selected base classes.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains anonymous naming, ordering and grammar limits; each optional field explains omission with separated member comments and tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ClassExpression {
  /** Discriminant tag; always `"ClassExpression"`. */
  kind: "ClassExpression";

  /** Leading modifiers and decorators when present. */
  modifiers?: readonly ModifierLike[];

  /** Optional local class name; absent represents an anonymous class. */
  name?: Identifier;

  /** Generic parameter declarations; absent omits the parameter list. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Ordered extends or implements clauses, if supplied. */
  heritageClauses?: readonly HeritageClause[];

  /** Class body entries in their source order. */
  members: readonly ClassElement[];
}
