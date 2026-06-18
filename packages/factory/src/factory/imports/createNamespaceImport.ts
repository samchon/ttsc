import type { Identifier, NamespaceImport } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamespaceImport}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @returns The created {@link NamespaceImport}.
 */
export const createNamespaceImport = (
  name: string | Identifier,
): NamespaceImport => make("NamespaceImport", { name: asName(name) });
