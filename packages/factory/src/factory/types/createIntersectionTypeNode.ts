import type { IntersectionTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link IntersectionTypeNode}: an `A & B` type.
 *
 * The constituents are joined with `&`. The printer is width-aware: when the
 * whole intersection fits on one line it stays inline as `A & B`, and when it
 * has to break it indents and puts each constituent on its own line with a
 * leading `&`, including a leading `&` before the first member.
 *
 * Given the constituents `A` and `B`, the printer renders:
 *
 * ```ts
 * A & B;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param types The constituent types.
 * @returns The created {@link IntersectionTypeNode}.
 */
export const createIntersectionTypeNode = (
  types: readonly TypeNode[],
): IntersectionTypeNode => make("IntersectionTypeNode", { types });
