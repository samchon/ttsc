import type { ImportAttribute } from "./ImportAttribute";

/**
 * A group of import attributes, e.g. `with { type: "json" }`.
 *
 * Built by {@link factory.createImportAttributes}.
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

  /** When `true`, print one entry per line. */
  multiLine?: boolean;
}
