import type { ConditionalTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConditionalTypeNode}: a `C extends E ? X : Y` conditional
 * type.
 *
 * The four type arms print in order, joined by `extends`, `?`, and `:`. The
 * printer emits each arm as-is without adding parentheses, so the caller is
 * responsible for wrapping any arm that needs grouping.
 *
 * Given check `T`, extends `U`, true `string`, and false `number`, the printer
 * renders:
 *
 * ```ts
 * T extends U ? string : number
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param checkType The type being tested.
 * @param extendsType The type tested against.
 * @param trueType The branch type when the test passes.
 * @param falseType The branch type when the test fails.
 * @returns The created {@link ConditionalTypeNode}.
 */
export const createConditionalTypeNode = (
  checkType: TypeNode,
  extendsType: TypeNode,
  trueType: TypeNode,
  falseType: TypeNode,
): ConditionalTypeNode =>
  make("ConditionalTypeNode", { checkType, extendsType, trueType, falseType });
