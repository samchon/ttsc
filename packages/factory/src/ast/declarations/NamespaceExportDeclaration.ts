import type { Identifier } from "../names/Identifier";

/**
 * An `export as namespace X` declaration.
 *
 * Built by {@link factory.createNamespaceExportDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamespaceExportDeclaration {
  /** Discriminant tag; always `"NamespaceExportDeclaration"`. */
  kind: "NamespaceExportDeclaration";

  /** Name. */
  name: Identifier;
}
