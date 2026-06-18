import type { Identifier } from "../names/Identifier";

/**
 * A single named import, optionally aliased.
 *
 * Built by {@link factory.createImportSpecifier}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportSpecifier {
  /** Discriminant tag; always `"ImportSpecifier"`. */
  kind: "ImportSpecifier";

  /** Whether this is a type-only import/export. */
  isTypeOnly: boolean;

  /** The original (source) name, when aliased. */
  propertyName?: Identifier;

  /** The name. */
  name: Identifier;
}
