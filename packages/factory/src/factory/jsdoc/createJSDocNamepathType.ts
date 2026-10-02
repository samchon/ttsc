import type { JSDocNamepathType, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocNamepathType}: a JSDoc namepath type.
 *
 * The `type` is the wrapped type. This node carries no marker of its own, so
 * the printer emits the wrapped type alone with no surrounding prefix or
 * suffix.
 *
 * With a `number` type, the printer emits:
 *
 * ```ts
 * number
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The child is retained under the namepath classification, but this wrapper supplies no module-prefix grammar or resolution and the printer emits only the child.
 * @evidence contracts/common.md#clear-and-simple-design One child assignment preserves the classification without duplicating the type spelling or adding unused module-lookup state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed module prefix or known-name lookup compensates for the representation's limited namepath payload.
 * @evidence contracts/common.md#meaningful-documentation Native prose explicitly states that no prefix or suffix is added and shows the child-only output, with separate paragraphs following the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @returns The created {@link JSDocNamepathType}.
 */
export const createJSDocNamepathType = (type: TypeNode): JSDocNamepathType =>
  make("JSDocNamepathType", {
    type,
  });
