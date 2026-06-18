import type {
  Expression,
  ModifierLike,
  PropertyDeclaration,
  PropertyName,
  Token,
  TypeNode,
} from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";

/**
 * Create a {@link PropertyDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param questionOrExclamationToken The optional (`?`) or definite-assignment
 *   (`!`) marker, if any.
 * @param type The type.
 * @param initializer The initializer, if any.
 * @returns The created {@link PropertyDeclaration}.
 */
export const createPropertyDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | PropertyName,
  questionOrExclamationToken: Token | undefined,
  type: TypeNode | undefined,
  initializer: Expression | undefined,
): PropertyDeclaration =>
  make("PropertyDeclaration", {
    modifiers,
    name: asPropertyName(name),
    questionOrExclamationToken,
    type,
    initializer,
  });
