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
 * string | number
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Ordered constituents remain a union structure; the printer chooses inline
 *   or leading-pipe layout without evaluating or reordering the represented types.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One list models union composition, without a second normalized set or an
 *   assignability engine inside a syntax constructor.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Members are not recognized by expected output names, dropped to force a
 *   narrower result or replaced by a fallback type for invalid caller outlines.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains width-dependent pipe placement in its own paragraph and
 *   gives the union itself, without an unrelated statement semicolon.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param types The constituent types.
 * @returns The created {@link UnionTypeNode}.
 */
export const createUnionTypeNode = (
  types: readonly TypeNode[],
): UnionTypeNode => make("UnionTypeNode", { types });
