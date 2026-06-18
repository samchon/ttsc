import type { ImportSpecifier } from "./ImportSpecifier";

/**
 * A `{ ... }` group of named import specifiers.
 *
 * Built by {@link factory.createNamedImports}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamedImports {
  /** Discriminant tag; always `"NamedImports"`. */
  kind: "NamedImports";

  /** The imported specifiers. */
  elements: readonly ImportSpecifier[];
}
