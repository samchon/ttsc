import type { Identifier, NamespaceExportDeclaration } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamespaceExportDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @returns The created {@link NamespaceExportDeclaration}.
 */
export const createNamespaceExportDeclaration = (
  name: string | Identifier,
): NamespaceExportDeclaration =>
  make("NamespaceExportDeclaration", { name: asName(name) });
