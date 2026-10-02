import type {
  Expression,
  Identifier,
  PrivateIdentifier,
  PropertyAccessChain,
  Token,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link PropertyAccessChain}: a member access that participates in an
 * optional chain, such as `a?.b`.
 *
 * `expression` is the receiver and `name` is the accessed member; a string
 * `name` is wrapped in an identifier. `questionDotToken`, when present, makes
 * this link optional and prints as `?.`; when omitted the printer emits a plain
 * `.` while the node still carries chain context.
 *
 * With `expression` of `a`, a `?.` token, and `name` of `b`, the printer emits:
 *
 * ```ts
 * a?.b
 * ```
 *
 * String names must be valid identifiers; private-name access must be legal
 * in its enclosing context. The constructor does not check those conditions.
 *
 * @evidence contracts/common.md#principled-implementation Strings normalize to Identifiers while supplied identifier nodes remain unchanged; chain kind and marker retain this-link optionality, with lexical/private-name legality caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design Shared identifier construction and make store one link, preserving preceding links in the receiver instead of flattening them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The marker is explicit optional syntax and name normalization does not guess member identity from consumer objects.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains marker absence, string normalization and name legality; example and ordered parameters are separated from tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The receiver expression.
 * @param questionDotToken The optional `?.` token, if this link is optional.
 * @param name The accessed member name.
 * @returns The created {@link PropertyAccessChain}.
 */
export const createPropertyAccessChain = (
  expression: Expression,
  questionDotToken: Token | undefined,
  name: string | Identifier | PrivateIdentifier,
): PropertyAccessChain =>
  make("PropertyAccessChain", {
    expression,
    questionDotToken,
    name: typeof name === "string" ? createIdentifier(name) : name,
  });
