import type { ExportSpecifier } from "./ExportSpecifier";

/**
 * A `{ ... }` group of named export specifiers.
 *
 * Built by {@link factory.createNamedExports}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation An ordered ExportSpecifier array preserves named export order without resolving bindings or enforcing unique exported names.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper owns brace grouping while specifiers own alias and type-only choices.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Elements are supplied syntax rather than hardcoded package export lists.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies braced named exports and the exported sequence; native spacing follows the documentation skill.
 */
export interface NamedExports {
  /** Discriminant tag; always `"NamedExports"`. */
  kind: "NamedExports";

  /** The exported specifiers. */
  elements: readonly ExportSpecifier[];
}
