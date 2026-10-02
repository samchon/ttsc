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
 * Omitting the type retains the property name and its optional brackets. Child
 * nodes are retained by reference, and no object-member existence check occurs.
 *
 * With the default tag name, name `x`, a `{number}` type expression, `the x`
 * comment, and `isNameFirst` of `true`, the printer emits:
 *
 * ```ts
 * @prop x {number} the x
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The name, bracket flag, optional braced type and comment map directly to property syntax, with boolean order normalization and a prop default for absent names; object membership is not established.
 * @evidence contracts/common.md#clear-and-simple-design Structured operands and independent syntax flags retain both orderings without another property model or flattened annotation parser.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Prop and type-first ordering are supported defaults, while arbitrary member nodes remain caller data rather than a known-object shape or foreign member mutation.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains optional brackets, ordering, omitted types and retained references with a concrete example; separate paragraphs and native tags follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
