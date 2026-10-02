import type { Identifier } from "../names/Identifier";

/**
 * A namespace import, e.g. `* as ns`.
 *
 * Built by {@link factory.createNamespaceImport}.
 *
 * @evidence contracts/common.md#principled-implementation Required Identifier preserves the local binding after * as without resolving the imported module's members.
 * @evidence contracts/common.md#clear-and-simple-design One binding-name field leaves source attachment to ImportDeclaration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The local namespace name is supplied data without consumer-specific aliases.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates namespace import spelling and identifies the local binding; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamespaceImport {
  /** Discriminant tag; always `"NamespaceImport"`. */
  kind: "NamespaceImport";

  /** Local namespace binding following as. */
  name: Identifier;
}
