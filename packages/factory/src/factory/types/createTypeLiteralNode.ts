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
 */
export const createTypeLiteralNode = (
  members: readonly TypeElement[] = [],
): TypeLiteralNode => make("TypeLiteralNode", { members });
