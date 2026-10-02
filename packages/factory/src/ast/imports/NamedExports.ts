import type { ExportSpecifier } from "./ExportSpecifier";

/**
 * A `{ ... }` group of named export specifiers.
 *
 * Built by {@link factory.createNamedExports}.
 *
 * @evidence contracts/common.md#principled-implementation An ordered ExportSpecifier array preserves named export order without resolving bindings or enforcing unique exported names.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper owns brace grouping while specifiers own alias and type-only choices.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Elements are supplied syntax rather than hardcoded package export lists.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies braced named exports and the exported sequence; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamedExports {
  /** Discriminant tag; always `"NamedExports"`. */
  kind: "NamedExports";

  /** The exported specifiers. */
  elements: readonly ExportSpecifier[];
}
