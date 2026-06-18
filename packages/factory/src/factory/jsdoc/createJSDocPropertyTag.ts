import type {
  EntityName,
  Identifier,
  JSDocComment,
  JSDocPropertyTag,
  JSDocTypeExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocPropertyTag}: a `@prop` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `prop` when omitted. The `name`
 * is the documented property, `isBracketed` wraps that name in square brackets
 * to mark it optional, and `typeExpression` supplies the brace-wrapped type.
 * The `isNameFirst` flag controls ordering: when `true` the name prints before
 * the type, when `false` the type prints first. The `comment` is the trailing
 * description.
 *
 * With the default tag name, name `x`, a `{number}` type expression, `the x`
 * comment, and `isNameFirst` of `true`, the printer emits:
 *
 * ```ts
 * @prop x {number} the x
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `prop`.
 * @param name The property name.
 * @param isBracketed Whether the name was wrapped in brackets.
 * @param typeExpression The type expression, if any.
 * @param isNameFirst Whether the name was written before the type.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocPropertyTag}.
 */
export const createJSDocPropertyTag = (
  tagName: Identifier | undefined,
  name: EntityName,
  isBracketed: boolean,
  typeExpression?: JSDocTypeExpression,
  isNameFirst: boolean = false,
  comment?: string | readonly JSDocComment[],
): JSDocPropertyTag =>
  make("JSDocPropertyTag", {
    tagName: tagName ?? createIdentifier("prop"),
    name,
    isBracketed,
    typeExpression,
    isNameFirst: !!isNameFirst,
    comment,
  });
