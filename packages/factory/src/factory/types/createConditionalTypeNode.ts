import type { ConditionalTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConditionalTypeNode}: a `C extends E ? X : Y` conditional
 * type.
 *
 * The four type arms print in order, joined by `extends`, `?`, and `:`. The
 * printer groups check and extends operands where their precedence requires it;
 * true and false branches retain their conditional-type nesting.
 *
 * Given check `T`, extends `U`, true `string`, and false `number`, the printer
 * renders:
 *
 * ```ts
 * T extends U ? string : number
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Check, extends, true and false types preserve their grammatical roles and
 *   order. Printer operand grouping protects the condition's precedence.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The factory stores four branches without evaluating assignability or
 *   duplicating the printer's conditional-type grouping rules.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The node retains both result branches for every input instead of choosing
 *   a precomputed result or recognizing a consumer's expected type.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc names all four roles and explains operand grouping separately from the
 *   concrete example; acknowledgments follow a blank comment line.
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
