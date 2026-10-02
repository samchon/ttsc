import type { Identifier } from "../names/Identifier";

/**
 * A single named import, optionally aliased.
 *
 * Built by {@link factory.createImportSpecifier}.
 *
 * @evidence contracts/common.md#principled-implementation Source name, local name and type-only flag preserve named import direction; Identifier-only source names leave string-literal binding syntax outside this shape.
 * @evidence contracts/common.md#clear-and-simple-design An optional source alias separates imported spelling from the required local binding.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Binding names are caller data without fixture-specific import substitutions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies renaming and member comments distinguish local/source names and type-only syntax; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportSpecifier {
  /** Discriminant tag; always `"ImportSpecifier"`. */
  kind: "ImportSpecifier";

  /** Whether type precedes this imported binding. */
  isTypeOnly: boolean;

  /** The original (source) name, when aliased. */
  propertyName?: Identifier;

  /** Local binding identifier; also the imported name when propertyName is absent. */
  name: Identifier;
}
