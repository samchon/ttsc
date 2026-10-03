import type { JSDocPropertyTag, JSDocTypeLiteral } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocTypeLiteral}: an object-shape type built from `@prop`
 * tags.
 *
 * The `jsDocPropertyTags` are the member property tags, which the printer emits
 * one per line. The `isArrayType` flag, when `true`, appends `[]` to mark the
 * literal as an array of that shape.
 *
 * Standing alone the literal prints as above. Inside a typedef tag it prints as
 * `{Object}` or `{Object[]}` and the property tags follow the typedef.
 *
 * The array and its children are retained by reference. This record is a tag
 * collection; it does not validate or brace-wrap a TypeScript object type.
 *
 * With a single `@prop {number} x` member tag and `isArrayType` of `false`, the
 * printer emits:
 *
 * ```ts
 * @prop {number} x
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Optional property tags and the array flag are retained for line-wise tag emission and an optional suffix; the result is a JSDoc shape record, not a validated TypeScript object type.
 * @evidence contracts/common.md#clear-and-simple-design Two direct fields distinguish members and array intent without a duplicate property map or inferred object-type representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Shape members remain explicit caller tags, and the false array default is syntax policy rather than a fixture-specific shape exception.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains line-wise members, the array suffix, retained references and the type-validation boundary; separated paragraphs follow the documentation guidance. The typedef form with {Object} or {Object[]} is stated.
 * @author Jeongho Nam - https://github.com/samchon
 * @param jsDocPropertyTags The member `@property` tags, if any.
 * @param isArrayType Whether the literal represents an array of its type.
 * @returns The created {@link JSDocTypeLiteral}.
 */
export const createJSDocTypeLiteral = (
  jsDocPropertyTags?: readonly JSDocPropertyTag[],
  isArrayType: boolean = false,
): JSDocTypeLiteral =>
  make("JSDocTypeLiteral", {
    jsDocPropertyTags,
    isArrayType,
  });
