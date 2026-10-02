import type { ObjectLiteralElement } from "./ObjectLiteralElement";

/**
 * An object literal, e.g. `{ a: 1 }`.
 *
 * Built by {@link factory.createObjectLiteralExpression}.
 *
 * Property order is preserved, including spreads whose position affects the
 * resulting value. The outline performs no evaluation or member-validity check.
 *
 * @evidence contracts/common.md#principled-implementation Ordered ObjectLiteralElement entries retain assignment, spread and method roles; order matters for overwrites, while member grammar remains a caller premise.
 * @evidence contracts/common.md#clear-and-simple-design One member sequence plus an optional layout hint describes the object; value evaluation and punctuation are not duplicated in the type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Members are preserved in caller order rather than merged into a guessed final object; multiLine is an explicit layout option.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains ordering and evaluation limits, while the layout member states width-dependent behavior with separated comments and tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ObjectLiteralExpression {
  /** Discriminant tag; always `"ObjectLiteralExpression"`. */
  kind: "ObjectLiteralExpression";

  /** The properties. */
  properties: readonly ObjectLiteralElement[];

  /** Force a broken layout when true; otherwise the printer chooses by width. */
  multiLine?: boolean;
}
