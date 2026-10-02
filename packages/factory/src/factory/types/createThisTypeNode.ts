import type { ThisTypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ThisTypeNode}: the `this` type.
 *
 * It takes no inputs and the printer always emits the single keyword `this`,
 * the polymorphic this-type used in fluent method return positions and type
 * predicates.
 *
 * The printer renders:
 *
 * ```ts
 * this
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   ThisTypeNode identifies polymorphic this in a type position rather than a
 *   value ThisExpression; contextual type legality belongs to its enclosing declaration.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The fixed keyword requires no fields or owner-class lookup; its type role
 *   is represented by the discriminant alone.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The fixed this spelling follows the node's grammar, not a hidden class
 *   name substitution or fixture-specific constant type.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc describes the type-level keyword and supplies a standalone example
 *   with the return type documented and tags separated from native prose.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link ThisTypeNode}.
 */
export const createThisTypeNode = (): ThisTypeNode => make("ThisTypeNode", {});
