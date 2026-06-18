import type {
  BigIntLiteral,
  LiteralTypeNode,
  NumericLiteral,
  StringLiteral,
  Token,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link LiteralTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param literal The literal.
 * @returns The created {@link LiteralTypeNode}.
 */
export const createLiteralTypeNode = (
  literal: StringLiteral | NumericLiteral | BigIntLiteral | Token,
): LiteralTypeNode => make("LiteralTypeNode", { literal });
