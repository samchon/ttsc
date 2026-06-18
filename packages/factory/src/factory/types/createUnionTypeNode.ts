import type { TypeNode, UnionTypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link UnionTypeNode}: an `A | B` type.
 *
 * The constituents are joined with `|`. The printer is width-aware: when the
 * whole union fits on one line it stays inline as `A | B`, and when it has to
 * break it indents and puts each constituent on its own line with a leading
 * `|`, including a leading `|` before the first member.
 *
 * Given the constituents `string` and `number`, the printer renders:
 *
 * ```ts
 * string | number;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param types The constituent types.
 * @returns The created {@link UnionTypeNode}.
 */
export const createUnionTypeNode = (
  types: readonly TypeNode[],
): UnionTypeNode => make("UnionTypeNode", { types });
