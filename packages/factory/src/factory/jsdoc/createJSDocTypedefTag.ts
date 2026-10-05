import type {
  Identifier,
  JSDocComment,
  JSDocTypeExpression,
  JSDocTypeLiteral,
  JSDocTypedefTag,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocTypedefTag}: a `@typedef` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `typedef` when omitted. The
 * `typeExpression` is the aliased type, either a brace-wrapped type expression
 * or a {@link JSDocTypeLiteral}. The `fullName` is the alias name, printed after
 * the type, and `comment` is the trailing description.
 *
 * A {@link JSDocTypeLiteral} is written as `{Object}`, or `{Object[]}` when it
 * is an array shape, and its property tags follow the typedef on their own
 * lines. Omitted type payloads leave the optional name and description. Child
 * nodes are retained by reference; no alias is bound in a compiler symbol
 * table.
 *
 * With the default tag name, a `{number}` type expression, and a `Count` name,
 * the printer emits:
 *
 * ```ts
 * @typedef {number} Count
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `typedef`.
 * @param typeExpression The aliased type, if any.
 * @param fullName The full alias name, if any.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocTypedefTag}.
 * @evidence contracts/common.md#principled-implementation Optional braced-type or property-tag payloads and an optional alias name are retained under typedef syntax, with a defaulted heading but no symbol binding or validity claim for every combination.
 * @evidence contracts/common.md#clear-and-simple-design Existing type-expression and type-literal nodes own the two payload forms, while this adapter only combines their optional presence with the alias heading.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Typedef is a supported name default, and supplied alias payloads are not replaced by fixture-specific resolved types or patched symbol-table entries.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains both payload forms, missing-type behavior, alias placement and retained references with an example; separated paragraphs follow the documentation guidance.
 */
export const createJSDocTypedefTag = (
  tagName: Identifier | undefined,
  typeExpression?: JSDocTypeExpression | JSDocTypeLiteral,
  fullName?: Identifier,
  comment?: string | readonly JSDocComment[],
): JSDocTypedefTag =>
  make("JSDocTypedefTag", {
    tagName: tagName ?? createIdentifier("typedef"),
    typeExpression,
    fullName,
    comment,
  });
