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
 * Create a {@link PropertyDeclaration}: a class field such as `x: number;`.
 *
 * The `modifiers` precede the property name, so `public readonly` prints in
 * that order. Any decorators among the modifiers are hoisted onto their own
 * lines above the property. The `name` is the field key, and the
 * `questionOrExclamationToken` appends either the optional marker (`?`) or the
 * definite-assignment marker (`!`) after the name.
 *
 * The optional `type` prints after a colon, and the optional `initializer`
 * prints after an `=`. The printer terminates the field with a semicolon.
 *
 * Given `public readonly` modifiers, the name `id`, a `string` type, and a
 * string-literal initializer of `"x"`, the printed field is:
 *
 * ```ts
 * public readonly id: string = "x";
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param questionOrExclamationToken The optional (`?`) or definite-assignment
 *   (`!`) marker, if any.
 * @param type The type.
 * @param initializer The initializer, if any.
 * @returns The created {@link PropertyDeclaration}.
 * @evidence contracts/common.md#principled-implementation
 *   Property-name normalization keeps computed/literal keys. Optional or
 *   definite-assignment token, type and initializer remain independent grammar
 *   slots; callers supply valid marker/type combinations.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The field declaration owns its header/default while child type/expression
 *   builders own those subtrees; class grouping and decorators are printed elsewhere.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Source field construction does not patch object properties or inject defaults.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains marker distinctions, decorators, typing and defaults
 *   in separated paragraphs with an example before acknowledgment tags.
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
