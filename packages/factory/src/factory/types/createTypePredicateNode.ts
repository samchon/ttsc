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
