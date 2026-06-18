import type {
  MappedTypeNode,
  Token,
  TypeElement,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link MappedTypeNode}: a `{ [K in keyof T]: T[K] }` mapped type.
 *
 * The type parameter supplies the key variable and its `in` constraint. When
 * `nameType` is present it adds an `as` key remap, and when `type` is present
 * it adds the `: ValueType` value. The whole thing renders inside `{ ... }` on
 * one line.
 *
 * The `readonlyToken` and `questionToken` carry optional modifier polarity. A
 * plain `readonly` or `?` token prints as `readonly ` and `?`; a `+` or `-`
 * token prefixes the modifier, so it prints as `+readonly`/`-readonly` and
 * `+?`/`-?`.
 *
 * Given a `K in keyof T` parameter and a `T[K]` value with no modifiers, the
 * printer renders:
 *
 * ```ts
 * { [K in keyof T]: T[K] }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param readonlyToken The `readonly` modifier with optional `+`/`-` polarity,
 *   if any.
 * @param typeParameter The key type parameter holding the `in` constraint.
 * @param nameType The `as` key remap type, if any.
 * @param questionToken The optional-marker `?` with optional `+`/`-` polarity,
 *   if any.
 * @param type The mapped value type, if any.
 * @param members The members, if any.
 * @returns The created {@link MappedTypeNode}.
 */
export const createMappedTypeNode = (
  readonlyToken: Token | undefined,
  typeParameter: TypeParameterDeclaration,
  nameType: TypeNode | undefined,
  questionToken: Token | undefined,
  type: TypeNode | undefined,
  members: readonly TypeElement[] | undefined,
): MappedTypeNode =>
  make("MappedTypeNode", {
    readonlyToken,
    typeParameter,
    nameType,
    questionToken,
    type,
    members,
  });
