import type { ConditionalTypeNode, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConditionalTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param checkType The checkType.
 * @param extendsType The extendsType.
 * @param trueType The trueType.
 * @param falseType The falseType.
 * @returns The created node.
 */
export const createConditionalTypeNode = (
  checkType: TypeNode,
  extendsType: TypeNode,
  trueType: TypeNode,
  falseType: TypeNode,
): ConditionalTypeNode =>
  make("ConditionalTypeNode", { checkType, extendsType, trueType, falseType });
