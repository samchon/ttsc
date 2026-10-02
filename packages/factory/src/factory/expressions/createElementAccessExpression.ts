import type { ElementAccessExpression, Expression } from "../../ast";
import { make } from "../internal/make";
import { createNumericLiteral } from "../literals/createNumericLiteral";

/**
 * Create an {@link ElementAccessExpression}: a `object[key]` bracket access.
 *
 * A numeric `index` is wrapped with {@link createNumericLiteral}; any other
 * expression is used as the key directly. The printer wraps the key in square
 * brackets, so a string key prints quoted (for example `obj["key"]`).
 *
 * Given object `obj` and index `0`, the printer emits:
 *
 * ```ts
 * obj[0]
 * ```
 *
 * A numeric index must have a valid literal spelling. String keys are supplied
 * as StringLiteral nodes, not bare JavaScript strings.
 *
 * @evidence contracts/common.md#principled-implementation Numeric indices normalize to lexical NumericLiteral nodes while expression keys remain supplied syntax; the ordinary access kind preserves its boundary from optional chaining.
 * @evidence contracts/common.md#clear-and-simple-design The numeric adapter is reused, and one make call records receiver and key without a separate lookup layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Keys are explicit accepted inputs rather than guessed property names or hardcoded access results.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains numeric normalization and the StringLiteral requirement, with example and parameter documentation separated from tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The object expression.
 * @param index The index or key.
 * @returns The created {@link ElementAccessExpression}.
 */
export const createElementAccessExpression = (
  expression: Expression,
  index: number | Expression,
): ElementAccessExpression =>
  make("ElementAccessExpression", {
    expression,
    argumentExpression:
      typeof index === "number" ? createNumericLiteral(index) : index,
  });
