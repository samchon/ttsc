import type { ComputedPropertyName, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ComputedPropertyName}: a `[expression]` property key.
 *
 * Used as the name of an object-literal member, class member or signature so
 * the key is computed at runtime. The printer wraps the expression in square
 * brackets.
 *
 * Given expression `key`, the printer emits the key:
 *
 * ```ts
 * [key]
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The unchanged key expression remains computed-name syntax, not a string obtained by evaluating it; the caller supplies a legal member-name context.
 * @evidence contracts/common.md#clear-and-simple-design One wrapper node records bracketed identity while the expression and printer retain their own responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The key is not guessed from a known object or hardcoded from an expected computed result.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies valid name positions and bracket emission; the fragment example and acknowledgment block are separated under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The key expression.
 * @returns The created {@link ComputedPropertyName}.
 */
export const createComputedPropertyName = (
  expression: Expression,
): ComputedPropertyName => make("ComputedPropertyName", { expression });
