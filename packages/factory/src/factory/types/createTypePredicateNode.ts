import type {
  Identifier,
  ThisTypeNode,
  Token,
  TypeNode,
  TypePredicateNode,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link TypePredicateNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param assertsModifier The assertsModifier.
 * @param parameterName The parameterName.
 * @param type The type.
 * @returns The created node.
 */
export const createTypePredicateNode = (
  assertsModifier: Token | undefined,
  parameterName: string | Identifier | ThisTypeNode,
  type: TypeNode | undefined,
): TypePredicateNode =>
  make("TypePredicateNode", {
    assertsModifier,
    parameterName:
      typeof parameterName === "string"
        ? createIdentifier(parameterName)
        : parameterName,
    type,
  });
