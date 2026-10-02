import type { ImportSpecifier } from "./ImportSpecifier";

/**
 * A `{ ... }` group of named import specifiers.
 *
 * Built by {@link factory.createNamedImports}.
 *
 * @evidence contracts/common.md#principled-implementation An ordered ImportSpecifier array preserves named binding order without checking binding conflicts or resolving exports.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper owns brace grouping while individual specifiers own local/source names.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Elements are supplied syntax, with no consumer-specific import list substitution.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies braced imports and their binding sequence; member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamedImports {
  /** Discriminant tag; always `"NamedImports"`. */
  kind: "NamedImports";

  /** The imported specifiers. */
  elements: readonly ImportSpecifier[];
}
