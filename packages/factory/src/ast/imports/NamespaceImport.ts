import type { Identifier } from "../names/Identifier";

/**
 * A namespace import, e.g. `* as ns`.
 *
 * Built by {@link factory.createNamespaceImport}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamespaceImport {
  /** Discriminant tag; always `"NamespaceImport"`. */
  kind: "NamespaceImport";

  /** The name. */
  name: Identifier;
}
