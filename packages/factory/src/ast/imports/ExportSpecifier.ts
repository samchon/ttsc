import type { Identifier } from "../names/Identifier";

/**
 * A single named export, optionally aliased.
 *
 * Built by {@link factory.createExportSpecifier}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ExportSpecifier {
  /** Discriminant tag; always `"ExportSpecifier"`. */
  kind: "ExportSpecifier";

  /** Whether this is a type-only import/export. */
  isTypeOnly: boolean;

  /** The original (source) name, when aliased. */
  propertyName?: Identifier;

  /** The name. */
  name: Identifier;
}
