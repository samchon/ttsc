import type { EntityName, TypeQueryNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TypeQueryNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param exprName The queried entity name.
 * @returns The created {@link TypeQueryNode}.
 */
export const createTypeQueryNode = (exprName: EntityName): TypeQueryNode =>
  make("TypeQueryNode", { exprName });
