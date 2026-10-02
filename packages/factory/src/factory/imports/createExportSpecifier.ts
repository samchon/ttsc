import type { ExportSpecifier, Identifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create an {@link ExportSpecifier}: one entry inside a {@link NamedExports}
 * brace group.
 *
 * Pass `propertyName` to export a local binding under a different name, which
 * prints as `propertyName as name`; leave it undefined for a plain binding.
 * Both names accept a raw string and are wrapped in identifiers for you. Set
 * `isTypeOnly` to prefix the single specifier with `type`.
 *
 * Given source name `x` aliased to `y`, this prints:
 *
 * ```ts
 * x as y
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional propertyName is the source name and name is the exposed name;
 *   string normalization preserves the alias distinction and type-only marker.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The specifier carries binding syntax; NamedExports and ExportDeclaration
 *   own grouping and any from clause.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Aliasing constructs source syntax rather than mutating an actual export table.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains omitted aliases, string inputs and type-only prefixes,
 *   with a source-as-target example and separate tag paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param isTypeOnly Whether this is a type-only import/export.
 * @param propertyName The original (source) name, when aliased.
 * @param name The name.
 * @returns The created {@link ExportSpecifier}.
 */
export const createExportSpecifier = (
  isTypeOnly: boolean,
  propertyName: string | Identifier | undefined,
  name: string | Identifier,
): ExportSpecifier =>
  make("ExportSpecifier", {
    isTypeOnly,
    propertyName: propertyName === undefined ? undefined : asName(propertyName),
    name: asName(name),
  });
