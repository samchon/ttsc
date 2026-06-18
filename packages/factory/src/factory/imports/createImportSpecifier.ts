import type { Identifier, ImportSpecifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ImportSpecifier}.
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
