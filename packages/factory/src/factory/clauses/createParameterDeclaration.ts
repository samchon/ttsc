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
 * Create a {@link ParameterDeclaration}.
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
