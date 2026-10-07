import type { Identifier } from "../names/Identifier";
import type { Token } from "../names/Token";
import type { ThisTypeNode } from "./ThisTypeNode";
import type { TypeNode } from "./TypeNode";

/**
 * A type predicate, e.g. `x is T` or `asserts x is T`.
 *
 * Built by {@link factory.createTypePredicateNode}.
 *
 * A predicate without an is-type is meaningful with asserts. The optional
 * fields permit other combinations, whose validity callers must establish.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Identifier/this target, optional asserts marker and optional is-type record predicate parts; their permissive combinations do not certify a valid predicate.
 * @evidence contracts/common.md#clear-and-simple-design Target and two optional clauses are independent fields rather than multiple overlapping predicate interfaces.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Assert presence is language syntax, without hardcoded narrowing outcomes.
 * @evidence contracts/common.md#meaningful-documentation JSDoc records the asserts-only form and field combination limitation; separated member prose follows the documentation skill.
 */
export interface TypePredicateNode {
  /** Discriminant tag; always `"TypePredicateNode"`. */
  kind: "TypePredicateNode";

  /** Presence of the asserts prefix; omitted for an ordinary is-predicate. */
  assertsModifier?: Token;

  /** Identifier or this whose value the predicate describes. */
  parameterName: Identifier | ThisTypeNode;

  /** Type after is; absent for an asserts-only predicate. */
  type?: TypeNode;
}
