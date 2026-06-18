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
 * void 0;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link VoidExpression}.
 */
export const createVoidZero = (): VoidExpression =>
  createVoidExpression(createNumericLiteral("0"));
