import type { TypeNode, TypeOperatorNode } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link TypeOperatorNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operator The operator token.
 * @param type The type.
 * @returns The created {@link TypeOperatorNode}.
 */
export const createTypeOperatorNode = (
  operator: SyntaxKind,
  type: TypeNode,
): TypeOperatorNode => make("TypeOperatorNode", { operator, type });
