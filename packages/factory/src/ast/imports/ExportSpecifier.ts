import type { Identifier } from "../names/Identifier";

/**
 * A single named export, optionally aliased.
 *
 * Built by {@link factory.createExportSpecifier}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Original name, exported name and type-only flag retain renaming direction; Identifier-only fields exclude string-literal export names from this model.
 * @evidence contracts/common.md#clear-and-simple-design Optional propertyName separates the aliased source from the always-present exported name.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Both names are caller data, with no special consumer exports encoded.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies aliasing and comments label original/exported names and type-only presence; member separation follows the documentation skill.
 */
export interface ExportSpecifier {
  /** Discriminant tag; always `"ExportSpecifier"`. */
  kind: "ExportSpecifier";

  /** Whether type precedes this exported binding. */
  isTypeOnly: boolean;

  /** The original (source) name, when aliased. */
  propertyName?: Identifier;

  /** Exported identifier; also the source name when propertyName is absent. */
  name: Identifier;
}
