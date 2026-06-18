import type { ExportSpecifier, NamedExports } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NamedExports}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The elements.
 * @returns The created {@link NamedExports}.
 */
export const createNamedExports = (
  elements: readonly ExportSpecifier[],
): NamedExports => make("NamedExports", { elements });
