import type {
  EntityName,
  Identifier,
  JSDocComment,
  JSDocParameterTag,
  JSDocTypeExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocParameterTag}: a `@param` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `param` when omitted. The
 * `name` is the documented parameter, `isBracketed` wraps that name in square
 * brackets to mark it optional, and `typeExpression` supplies the brace-wrapped
 * type. The `isNameFirst` flag controls ordering: when `true` the name prints
 * before the type, when `false` the type prints first. The `comment` is the
 * trailing description.
 *
 * With the default tag name, name `x`, a `{number}` type expression, and a `the
 * x` comment, `isNameFirst` of `true` prints the name ahead of the type:
 *
 * ```ts
 * @param x {number} the x
 * ```
 *
 * The same inputs with `isNameFirst` of `false` print the type first:
 *
 * ```ts
 * @param {number} x the x
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `param`.
 * @param name The parameter name.
 * @param isBracketed Whether the name was wrapped in brackets.
 * @param typeExpression The type expression, if any.
 * @param isNameFirst Whether the name was written before the type.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocParameterTag}.
 */
export const createJSDocParameterTag = (
  tagName: Identifier | undefined,
  name: EntityName,
  isBracketed: boolean,
  typeExpression?: JSDocTypeExpression,
  isNameFirst: boolean = false,
  comment?: string | readonly JSDocComment[],
): JSDocParameterTag =>
  make("JSDocParameterTag", {
    tagName: tagName ?? createIdentifier("param"),
    name,
    isBracketed,
    typeExpression,
    isNameFirst: !!isNameFirst,
    comment,
  });
