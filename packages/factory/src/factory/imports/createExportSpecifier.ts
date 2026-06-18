import type { ExportSpecifier, Identifier } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ExportSpecifier}.
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
