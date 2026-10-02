import type { Identifier } from "../names/Identifier";

/**
 * A namespace re-export, e.g. `export * as ns`.
 *
 * Built by {@link factory.createNamespaceExport}.
 *
 * @evidence contracts/common.md#principled-implementation Required Identifier names the namespace following * as; resolution of the exported module is outside this clause.
 * @evidence contracts/common.md#clear-and-simple-design One name field represents the namespace clause while its declaration owns the from operand.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The exported name is caller data, not a hardcoded namespace for consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates star-as export and labels the namespace name; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamespaceExport {
  /** Discriminant tag; always `"NamespaceExport"`. */
  kind: "NamespaceExport";

  /** Exported namespace identifier following as. */
  name: Identifier;
}
