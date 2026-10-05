import type { TypeElement, TypeLiteralNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link TypeLiteralNode}: an inline object type such as `{ name:
 * string }`.
 *
 * The members print inside `{ ... }` and may be any type element: property and
 * method signatures, index and call signatures, and so on. The member block is
 * width-aware, staying inline when it fits and breaking onto separate lines
 * when it does not. The member list defaults to empty, which renders as `{}`.
 *
 * Given a single `name: string` property, the printer renders:
 *
 * ```ts
 * { name: string }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param members The type members.
 * @returns The created {@link TypeLiteralNode}.
 * @evidence contracts/common.md#principled-implementation
 *   Ordered TypeElement children define the anonymous shape, and the empty
 *   default creates an empty member list rather than a fabricated property.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The shape needs one member array; braces and member separators stay with
 *   the printer and signature constructors own individual member structure.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The empty default is part of the public API. No expected property names
 *   or consumer schemas inject additional members into the supplied shape.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc describes empty/nonempty shapes and member-list layout, with
 *   the default and return type recorded separately from the example.
 */
export const createTypeLiteralNode = (
  members: readonly TypeElement[] = [],
): TypeLiteralNode => make("TypeLiteralNode", { members });
