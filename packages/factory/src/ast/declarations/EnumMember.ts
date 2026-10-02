import type { Expression } from "../expressions/Expression";
import type { PropertyName } from "../names/PropertyName";

/**
 * A member of an enum declaration.
 *
 * Built by {@link factory.createEnumMember}.
 *
 * @evidence contracts/common.md#principled-implementation A shared PropertyName and optional initializer retain enum-member spelling; broad property-name legality and initializer evaluation are not checked here.
 * @evidence contracts/common.md#clear-and-simple-design Two fields separate member naming from optional value syntax, reusing existing node types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Omitted initializer is source syntax, not a precomputed numeric value or consumer-specific enum case.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies enum-member use and optional initializer meaning; separated member prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface EnumMember {
  /** Discriminant tag; always `"EnumMember"`. */
  kind: "EnumMember";

  /** The name. */
  name: PropertyName;

  /** The initializer, if any. */
  initializer?: Expression;
}
