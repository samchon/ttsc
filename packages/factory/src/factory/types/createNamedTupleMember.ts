import type { Identifier, NamedTupleMember, Token, TypeNode } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamedTupleMember}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param dotDotDotToken The dotDotDotToken.
 * @param name The name.
 * @param questionToken The questionToken.
 * @param type The type.
 * @returns The created node.
 */
export const createNamedTupleMember = (
  dotDotDotToken: Token | undefined,
  name: string | Identifier,
  questionToken: Token | undefined,
  type: TypeNode,
): NamedTupleMember =>
  make("NamedTupleMember", {
    dotDotDotToken,
    name: asName(name),
    questionToken,
    type,
  });
