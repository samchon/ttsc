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
 * With a single `@prop {number} x` member tag and `isArrayType` of `false`, the
 * printer emits:
 *
 * ```ts
 * @prop {number} x
 * ```
 *
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
