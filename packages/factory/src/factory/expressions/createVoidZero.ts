import type { VoidExpression } from "../../ast";
import { createNumericLiteral } from "../literals/createNumericLiteral";
import { createVoidExpression } from "./createVoidExpression";

/**
 * Convenience wrapper that builds the corresponding expression node.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created expression.
 */
export const createVoidZero = (): VoidExpression =>
  createVoidExpression(createNumericLiteral("0"));
