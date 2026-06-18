import type { Identifier, NamespaceExport } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamespaceExport}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @returns The created {@link NamespaceExport}.
 */
export const createNamespaceExport = (
  name: string | Identifier,
): NamespaceExport => make("NamespaceExport", { name: asName(name) });
