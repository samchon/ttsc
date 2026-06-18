import type { Identifier } from "../names/Identifier";

/**
 * A namespace re-export, e.g. `export * as ns`.
 *
 * Built by {@link factory.createNamespaceExport}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamespaceExport {
  /** Discriminant tag; always `"NamespaceExport"`. */
  kind: "NamespaceExport";

  /** Name. */
  name: Identifier;
}
