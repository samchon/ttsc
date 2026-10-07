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
 * Create a {@link TypePredicateNode}: a `x is T` type guard return type, or an
 * `asserts x is T` / `asserts x` assertion form.
 *
 * A leading `asserts ` prints when the asserts modifier is present, then the
 * parameter name, then ` is Type` when a type is present. The assertion form
 * with no type (just `asserts x`) is produced by passing the modifier and
 * omitting the type. A string parameter name is normalized to an identifier.
 *
 * Given no asserts modifier, parameter `x`, and a `string` type, the printer
 * renders:
 *
 * ```ts
 * x is string
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param assertsModifier The `asserts` modifier, if any.
 * @param parameterName The guarded parameter name, or `this`.
 * @param type The narrowed type, if any.
 * @returns The created {@link TypePredicateNode}.
 * @evidence contracts/common.md#principled-implementation
 *   Strings become identifiers while Identifier/ThisTypeNode inputs are kept;
 *   the asserts marker and optional target type preserve guard versus assertion forms.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single predicate node covers x is T, asserts x is T and asserts x without
 *   constructing separate return-signature wrappers or evaluating narrowing.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Guard names do not trigger inferred target types, and an absent target is
 *   not patched with a type solely to match a consumer's expected guard.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose separates assertion-marker presence from target-type presence
 *   and documents identifier/this inputs alongside a guard example.
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
