import type { SyntaxKind } from "../../syntax";

/**
 * A keyword type, e.g. `string`, `number`, `void`.
 *
 * Built by {@link factory.createKeywordTypeNode}.
 *
 * SyntaxKind also contains non-type tokens. Callers must choose a keyword
 * valid in type position; this shape does not enforce that subset.
 *
 * @evidence contracts/common.md#principled-implementation A keyword code under a distinct type-node kind represents primitive keyword spelling; its broad SyntaxKind restriction is documented honestly.
 * @evidence contracts/common.md#clear-and-simple-design One keyword payload avoids a separate interface for each primitive type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Keyword values describe language tokens, not special types chosen for consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc gives keyword examples and the valid-token limitation in separate paragraphs following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface KeywordTypeNode {
  /** Discriminant tag; always `"KeywordTypeNode"`. */
  kind: "KeywordTypeNode";

  /** The keyword token (e.g. `string`, `number`, `void`). */
  keyword: SyntaxKind;
}
