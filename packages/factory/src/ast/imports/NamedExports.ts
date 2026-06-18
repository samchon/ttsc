import type { ExportSpecifier } from "./ExportSpecifier";

/**
 * A `{ ... }` group of named export specifiers.
 *
 * Built by {@link factory.createNamedExports}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamedExports {
  /** Discriminant tag; always `"NamedExports"`. */
  kind: "NamedExports";

  /** The exported specifiers. */
  elements: readonly ExportSpecifier[];
}
