import type { Identifier, NamedTupleMember, Token, TypeNode } from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link NamedTupleMember}: a labeled tuple element such as `name:
 * string`.
 *
 * A leading `...` prints when the rest token is present, then the label, then a
 * `?` when the question token is present, then `: ` followed by the type. A
 * string name is normalized to an identifier.
 *
 * Given the label `name` and a `string` type, the printer renders:
 *
 * ```ts
 * name: string;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param dotDotDotToken The rest marker (`...`), if any.
 * @param name The element label.
 * @param questionToken The optional marker (`?`), if any.
 * @param type The element type.
 * @returns The created {@link NamedTupleMember}.
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
