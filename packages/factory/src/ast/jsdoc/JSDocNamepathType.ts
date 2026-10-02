import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc namepath type, e.g. `module:foo.Bar`.
 *
 * Built by {@link factory.createJSDocNamepathType}.
 *
 * The current printer emits only the wrapped type. This node does not add or
 * encode a `module:` prefix; callers must not infer namepath resolution from it.
 *
 * @evidence contracts/common.md#principled-implementation A kind and required child preserve the AST's namepath classification, but TypeNode alone does not model a module-prefix grammar and the printer supplies no such prefix.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper records one classification and delegates child structure; it stores no second spelling or unresolved module-lookup state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The child remains explicit caller data rather than receiving a guessed module prefix or consumer-specific symbol lookup.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the printer's prefix limitation and lack of namepath resolution, keeping that caveat in a separate paragraph under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocNamepathType {
  /** Discriminant tag; always `"JSDocNamepathType"`. */
  kind: "JSDocNamepathType";

  /** The wrapped type. */
  type: TypeNode;
}
