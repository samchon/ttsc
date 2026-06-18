import type {
  Expression,
  Identifier,
  ModifierLike,
  ParameterDeclaration,
  Token,
  TypeNode,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ParameterDeclaration}: a single function or method parameter.
 *
 * The `modifiers` precede the parameter name. On a constructor these are the
 * accessibility keywords such as `public` or `readonly` that turn it into a
 * parameter property; any decorators among them stay inline, in front of the
 * name, rather than moving to their own line. The `dotDotDotToken` marks a rest
 * parameter (`...args`), and the `questionToken` marks it optional (`name?`).
 *
 * The `name` accepts a string or a binding pattern. The optional `type` prints
 * after a colon, and the optional `initializer` supplies a default value after
 * an `=`.
 *
 * Given a `readonly` modifier, the name `value`, and a `number` type, the
 * printed parameter is:
 *
 * ```ts
 * readonly value: number
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param dotDotDotToken The rest marker (`...`), if any.
 * @param name The name.
 * @param questionToken The optional marker (`?`), if any.
 * @param type The type.
 * @param initializer The initializer, if any.
 * @returns The created {@link ParameterDeclaration}.
 */
export const createParameterDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  dotDotDotToken: Token | undefined,
  name: string | Identifier,
  questionToken?: Token,
  type?: TypeNode,
  initializer?: Expression,
): ParameterDeclaration =>
  make("ParameterDeclaration", {
    modifiers,
    dotDotDotToken,
    name: asName(name),
    questionToken,
    type,
    initializer,
  });
