import type { IndexedAccessTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link IndexedAccessTypeNode}: a `T[K]` indexed access type.
 *
 * The object type is emitted in postfix-operand position, so a lower-precedence
 * form (union, intersection, function, constructor, conditional, infer,
 * type-operator, or type-query) gets wrapped in parentheses before the `[...]`.
 * The index type prints bare inside the brackets.
 *
 * Given a `T` object type and a `"key"` index, the printer renders:
 *
 * ```ts
 * T["key"]
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Object and index types occupy different fields, preserving a type-level
 *   lookup; postfix operand grouping belongs to the printer.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A two-child node represents indexed access without duplicating value-level
 *   element access or attempting to evaluate the selected type.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Keys remain type nodes, with no lookup table for consumer-specific names or
 *   raw bracket strings replacing the input structure.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes object and index roles and explains why grouping is
 *   needed, using a standalone lookup type in its example.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param objectType The object type being indexed.
 * @param indexType The index type.
 * @returns The created {@link IndexedAccessTypeNode}.
 */
export const createIndexedAccessTypeNode = (
  objectType: TypeNode,
  indexType: TypeNode,
): IndexedAccessTypeNode =>
  make("IndexedAccessTypeNode", { objectType, indexType });
