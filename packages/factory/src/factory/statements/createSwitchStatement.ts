import type { CaseBlock, Expression, SwitchStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SwitchStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param caseBlock The caseBlock.
 * @returns The created {@link SwitchStatement}.
 */
export const createSwitchStatement = (
  expression: Expression,
  caseBlock: CaseBlock,
): SwitchStatement => make("SwitchStatement", { expression, caseBlock });
