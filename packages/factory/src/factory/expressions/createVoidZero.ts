import type { VoidExpression } from "../../ast";
import { createNumericLiteral } from "../literals/createNumericLiteral";
import { createVoidExpression } from "./createVoidExpression";

/**
 * Create the `void 0` expression, the canonical way to spell `undefined`.
 *
 * Thin wrapper over {@link createVoidExpression} with the numeric literal `0` as
 * its operand.
 *
 * The printer emits:
 *
 * ```ts
 * void 0
 * ```
 *
 * Unlike an identifier named undefined, this spelling does not depend on
 * whether an enclosing scope shadows that name.
 *
 * @evidence contracts/common.md#principled-implementation Void applied to a side-effect-free numeric zero expresses undefined independently of any binding named undefined; construction composes those syntax nodes without evaluation.
 * @evidence contracts/common.md#clear-and-simple-design Existing numeric and void builders compose the complete expression without a dedicated undefined node or scope resolver.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The zero literal is this documented idiom's operand, not a consumer answer or measurement value hardcoded into unrelated logic.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the shadowing-independent reason for void 0; its expression example and acknowledgment block follow documentation separation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link VoidExpression}.
 */
export const createVoidZero = (): VoidExpression =>
  createVoidExpression(createNumericLiteral("0"));
