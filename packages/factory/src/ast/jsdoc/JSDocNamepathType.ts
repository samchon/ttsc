import type { TypeNode } from "../types/TypeNode";

/**
 * A JSDoc namepath type, e.g. `module:foo.Bar`.
 *
 * Built by {@link factory.createJSDocNamepathType}.
 *
 * The current printer emits only the wrapped type. This node does not add or
 * encode a `module:` prefix; callers must not infer namepath resolution from
 * it.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A kind and required child preserve the AST's namepath classification, but TypeNode alone does not model a module-prefix grammar and the printer supplies no such prefix.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper records one classification and delegates child structure; it stores no second spelling or unresolved module-lookup state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The child remains explicit caller data rather than receiving a guessed module prefix or consumer-specific symbol lookup.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the printer's prefix limitation and lack of namepath resolution, keeping that caveat in a separate paragraph under the documentation guidance.
 */
export interface JSDocNamepathType {
  /** Discriminant tag; always `"JSDocNamepathType"`. */
  kind: "JSDocNamepathType";

  /** The wrapped type. */
  type: TypeNode;
}
