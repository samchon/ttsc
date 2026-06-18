import type { Identifier } from "../names/Identifier";
import type { Token } from "../names/Token";
import type { ThisTypeNode } from "./ThisTypeNode";
import type { TypeNode } from "./TypeNode";

/**
 * A type predicate, e.g. `x is T` or `asserts x is T`.
 *
 * Built by {@link factory.createTypePredicateNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypePredicateNode {
  /** Discriminant tag; always `"TypePredicateNode"`. */
  kind: "TypePredicateNode";

  /** AssertsModifier. */
  assertsModifier?: Token;

  /** ParameterName. */
  parameterName: Identifier | ThisTypeNode;

  /** Type. */
  type?: TypeNode;
}
