/**
 * The JSDoc all type `*`.
 *
 * Built by {@link factory.createJSDocAllType}.
 *
 * This is the bare JSDoc wildcard, distinct from a TypeScript keyword node.
 *
 * @evidence contracts/common.md#principled-implementation A payload-free literal kind represents the JSDoc wildcard because its spelling is always an asterisk and has no child operands.
 * @evidence contracts/common.md#clear-and-simple-design One discriminant captures the complete wildcard form without storing redundant spelling or a separate wildcard flag.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed kind is the syntax identity of the wildcard, not a fixture answer or a consumer-dependent override.
 * @evidence contracts/common.md#meaningful-documentation The native description states the wildcard spelling and its distinction from a TypeScript keyword, with prose separated from acknowledgment tags as required by the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocAllType {
  /** Discriminant tag; always `"JSDocAllType"`. */
  kind: "JSDocAllType";
}
