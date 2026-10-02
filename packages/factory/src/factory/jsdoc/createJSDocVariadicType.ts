import type { JSDocVariadicType, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocVariadicType}: a JSDoc `...`-marked variadic type.
 *
 * The `type` is the wrapped element type. The printer prepends a `...` marker
 * before it.
 *
 * The element accepts TypeNode forms, including JSDoc-specific wrappers.
 * Construction does not check placement in a function parameter list.
 *
 * With a `number` type, the printer emits:
 *
 * ```ts
 * ...number
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The required TypeNode child, including JSDoc forms, supplies the element syntax and the variadic kind supplies the ellipsis without asserting legal rest placement.
 * @evidence contracts/common.md#clear-and-simple-design The single-operand adapter separates element syntax from parameter-list ownership and stores no redundant prefix string.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Variadic syntax is caller intent rather than a known-argument shortcut or injected rest behavior in a foreign function.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the element role, supported child forms and placement boundary with an output example; separate paragraphs follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @returns The created {@link JSDocVariadicType}.
 */
export const createJSDocVariadicType = (type: TypeNode): JSDocVariadicType =>
  make("JSDocVariadicType", {
    type,
  });
