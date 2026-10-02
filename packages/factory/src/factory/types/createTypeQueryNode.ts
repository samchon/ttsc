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
 * typeof foo
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The EntityName child identifies the value being queried in a type position;
 *   TypeQueryNode preserves this meaning separately from a prefix type operator.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One entity-name field represents the supported query surface without a
 *   symbol resolver or speculative generic-argument extension.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No queried name selects a hardcoded type and no compiler lookup result is
 *   fabricated by this syntax-only constructor.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc describes the queried value name and typeof type syntax, showing the
 *   bare query rather than adding a statement terminator.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param exprName The queried entity name.
 * @returns The created {@link TypeQueryNode}.
 */
export const createTypeQueryNode = (exprName: EntityName): TypeQueryNode =>
  make("TypeQueryNode", { exprName });
