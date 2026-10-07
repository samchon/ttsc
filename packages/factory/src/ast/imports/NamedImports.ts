import type { ImportSpecifier } from "./ImportSpecifier";

/**
 * A `{ ... }` group of named import specifiers.
 *
 * Built by {@link factory.createNamedImports}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation An ordered ImportSpecifier array preserves named binding order without checking binding conflicts or resolving exports.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper owns brace grouping while individual specifiers own local/source names.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Elements are supplied syntax, with no consumer-specific import list substitution.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies braced imports and their binding sequence; member separation follows the documentation skill.
 */
export interface NamedImports {
  /** Discriminant tag; always `"NamedImports"`. */
  kind: "NamedImports";

  /** The imported specifiers. */
  elements: readonly ImportSpecifier[];
}
