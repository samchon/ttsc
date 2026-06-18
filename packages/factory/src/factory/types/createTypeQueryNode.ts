import type { EntityName, TypeQueryNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TypeQueryNode}: a `typeof x` type query.
 *
 * The `typeof ` keyword prints in front of the queried entity name, which may
 * be a qualified name such as `typeof ns.value`. This yields the type of a
 * value rather than referencing a type directly.
 *
 * Given the entity name `foo`, the printer renders:
 *
 * ```ts
 * typeof foo;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param exprName The queried entity name.
 * @returns The created {@link TypeQueryNode}.
 */
export const createTypeQueryNode = (exprName: EntityName): TypeQueryNode =>
  make("TypeQueryNode", { exprName });
