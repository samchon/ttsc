import type { ImportSpecifier, NamedImports } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NamedImports}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The created {@link NamedImports}.
 */
export const createNamedImports = (
  elements: readonly ImportSpecifier[],
): NamedImports => make("NamedImports", { elements });
