import type { ImportAttribute } from "./ImportAttribute";

/**
 * A group of import attributes, e.g. `with { type: "json" }`.
 *
 * Built by {@link factory.createImportAttributes}.
 *
 * Setting multiLine forces a nonempty attribute group to break across lines.
 * Otherwise the printer chooses layout from the available width.
 *
 * @evidence contracts/common.md#principled-implementation Ordered entries and with/assert keyword distinguish current and legacy attribute syntax; key uniqueness and valid values remain unchecked.
 * @evidence contracts/common.md#clear-and-simple-design One collection owns keyword and optional layout while ImportAttribute owns each entry.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Legacy assert is an explicit supported spelling, not a compensating runtime module patch.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates attributes and distinguishes forced multiline from width-based layout; separated member comments follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportAttributes {
  /** Discriminant tag; always `"ImportAttributes"`. */
  kind: "ImportAttributes";

  /** The attribute entries. */
  elements: readonly ImportAttribute[];

  /** The introducing keyword: `with` (default) or the legacy `assert`. */
  token: "with" | "assert";

  /** Force a nonempty group to break across lines; false or absent leaves layout width-based. */
  multiLine?: boolean;
}
