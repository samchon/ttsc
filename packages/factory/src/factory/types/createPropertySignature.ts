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
 * Create a {@link PropertySignature}: a `name?: T` property in an interface or
 * type literal.
 *
 * Any modifiers print first (for example `readonly`), then the name, then a `?`
 * when the question token is present, then `: ` followed by the type when
 * present. A string name is normalized to a property name node.
 *
 * Given the name `name`, a present question token, and a `string` type, the
 * printer renders:
 *
 * ```ts
 * name?: string
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The property name.
 * @param questionToken The optional marker (`?`), if any.
 * @param type The property type, if any.
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
