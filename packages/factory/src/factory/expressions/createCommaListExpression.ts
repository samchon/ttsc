import type { CommaListExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CommaListExpression}: a synthetic list of expressions joined
 * by commas, used where several expressions are emitted in sequence.
 *
 * Unlike a chain of comma {@link BinaryExpression} nodes, this is a flat list.
 * The printer separates the elements with a comma and a space.
 *
 * Given elements `a`, `b`, `c`, the printer emits:
 *
 * ```ts
 * a, b, c
 * ```
 *
 * Supply at least one valid operand. Parentheses are added only when required
 * by the enclosing expression context, not by this flat node itself.
 *
 * @evidence contracts/common.md#principled-implementation An unchanged flat sequence preserves comma-operand order without nested binary nodes; nonempty valid expression input is a caller premise.
 * @evidence contracts/common.md#clear-and-simple-design One make call records the ordered list while printer context owns separators and necessary grouping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Operands remain structured expressions rather than text fragments spliced around a missing tree.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes the flat form, minimum operand requirement and contextual parentheses; its direct output example and tags are separate.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The element expressions.
 * @returns The created {@link CommaListExpression}.
 */
export const createCommaListExpression = (
  elements: readonly Expression[],
): CommaListExpression => make("CommaListExpression", { elements });
