import type { ParenthesizedTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ParenthesizedTypeNode}: a `(T)` explicitly parenthesized type.
 *
 * The printer always wraps the inner type in literal parentheses, so this is
 * the way to force grouping the surrounding printer would not add on its own,
 * for example to disambiguate a union inside a larger type.
 *
 * Given an `A | B` inner type, the printer renders:
 *
 * ```ts
 * (A | B)
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   ParenthesizedTypeNode retains an explicit grouping boundary around its
 *   child, even where the surrounding precedence would not demand parentheses.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One wrapper records grouping directly, without attaching mutable printer
 *   flags to the child or serializing its syntax in advance.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Parentheses are represented by the node kind rather than patched around
 *   selected child names or expected printed fragments.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The corrected example includes the promised parentheses and the prose
 *   explains explicit grouping separately from automatic printer grouping.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The inner type to parenthesize.
 * @returns The created {@link ParenthesizedTypeNode}.
 */
export const createParenthesizedType = (
  type: TypeNode,
): ParenthesizedTypeNode => make("ParenthesizedTypeNode", { type });
