import type {
  Expression,
  Identifier,
  PrivateIdentifier,
  PropertyAccessExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link PropertyAccessExpression}: a dotted member access like `a.b`.
 *
 * `expression` is the receiver and `name` is the accessed member; a string
 * `name` is wrapped in an identifier. The printer joins them with a single dot
 * and no surrounding space.
 *
 * With `expression` of `a` and `name` of `b`, the printer emits:
 *
 * ```ts
 * a.b
 * ```
 *
 * Strings must be valid member identifiers; private-name context is not
 * validated here. Use a chain builder when this link continues optional chaining.
 *
 * @evidence contracts/common.md#principled-implementation String names normalize to Identifiers and supplied name nodes remain intact; the ordinary-access kind distinguishes its chain boundary, with valid lexical and private-name context caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design One name adapter and make call capture receiver/member syntax without a lookup abstraction or alternate chain schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The builder does not inspect known receiver objects to guess a member or monkey-patch their property access.
 * @evidence contracts/common.md#meaningful-documentation Native prose states name normalization, validity limits and the chain distinction, with example, parameters and acknowledgment block separated.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The receiver expression.
 * @param name The accessed member name.
 * @returns The created {@link PropertyAccessExpression}.
 */
export const createPropertyAccessExpression = (
  expression: Expression,
  name: string | Identifier | PrivateIdentifier,
): PropertyAccessExpression =>
  make("PropertyAccessExpression", {
    expression,
    name: typeof name === "string" ? createIdentifier(name) : name,
  });
