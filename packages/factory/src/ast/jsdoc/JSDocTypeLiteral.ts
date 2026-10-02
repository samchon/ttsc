import type { JSDocPropertyTag } from "./JSDocPropertyTag";

/**
 * A JSDoc type literal: an object type expressed through `@property` tags.
 *
 * Built by {@link factory.createJSDocTypeLiteral}.
 *
 * The printer emits property tags on separate lines and appends `[]` when
 * isArrayType is true. Inside a typedef tag it prints as `{Object}` or
 * `{Object[]}` and the property tags follow the typedef. Omitted properties
 * produce no member text. This is a tag collection, not a validated or
 * brace-wrapped TypeScript object type.
 *
 * @evidence contracts/common.md#principled-implementation Ordered property tags and an array flag preserve the represented JSDoc shape, while the current printer emits tag lines and an optional suffix rather than validating object-type grammar.
 * @evidence contracts/common.md#clear-and-simple-design One optional member collection and one array distinction capture the payload without duplicating a TypeScript type literal or inferred property map.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Properties remain explicit structured tags and the array suffix is grammar data, not a known-shape shortcut or a guessed semantic type.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains omitted properties, multiline output and the representation's object-type limitation, with separated paragraphs and members under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocTypeLiteral {
  /** Discriminant tag; always `"JSDocTypeLiteral"`. */
  kind: "JSDocTypeLiteral";

  /** The member `@property` tags, if any. */
  jsDocPropertyTags?: readonly JSDocPropertyTag[];

  /** If true, this literal represents an _array_ of its type. */
  isArrayType: boolean;
}
