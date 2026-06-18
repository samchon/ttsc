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
 * x as y;
 * ```
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
