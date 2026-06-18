import type { Identifier, ImportSpecifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create an {@link ImportSpecifier}: one entry inside a {@link NamedImports}
 * brace group.
 *
 * Pass `propertyName` to alias an export under a different local name, which
 * prints as `propertyName as name`; leave it undefined for a plain binding. The
 * `name` accepts a raw string and is wrapped in an identifier for you. Set
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
 * @returns The created {@link ImportSpecifier}.
 */
export const createImportSpecifier = (
  isTypeOnly: boolean,
  propertyName: Identifier | undefined,
  name: string | Identifier,
): ImportSpecifier =>
  make("ImportSpecifier", { isTypeOnly, propertyName, name: asName(name) });
