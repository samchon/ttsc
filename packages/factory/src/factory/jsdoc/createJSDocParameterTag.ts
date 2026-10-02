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
 * No executable parameter consistency check is performed. The type and name
 * nodes are retained by reference; omission of the type still prints the name
 * and its optional brackets.
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
 * @evidence contracts/common.md#principled-implementation Name, brackets, optional braced type and description map directly to the tag, while the name-order input is normalized to a boolean and an absent identifier defaults to param; no function correspondence is inferred.
 * @evidence contracts/common.md#clear-and-simple-design Independent bracket and ordering flags expose two separate syntax decisions beside reusable name and type nodes, without alternate flattened parameter formats.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Param and type-first ordering are documented defaults rather than known-argument special cases; caller signatures and foreign parameter tables are not changed.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains both ordering forms, bracket/type independence, retained nodes and unchecked executable correspondence; examples and parameter tags use separated paragraphs under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
