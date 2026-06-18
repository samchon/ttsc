import type {
  ModifierLike,
  PropertyName,
  PropertySignature,
  Token,
  TypeNode,
} from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";

/**
 * Create a {@link PropertySignature}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param questionToken The optional marker (`?`), if any.
 * @param type The type.
 * @returns The created {@link PropertySignature}.
 */
export const createPropertySignature = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | PropertyName,
  questionToken: Token | undefined,
  type: TypeNode | undefined,
): PropertySignature =>
  make("PropertySignature", {
    modifiers,
    name: asPropertyName(name),
    questionToken,
    type,
  });
