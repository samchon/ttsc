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
 * @evidence contracts/common.md#principled-implementation
 *   The property-name helper normalizes strings while retaining structured
 *   names; modifiers, question token and optional type occupy distinct member fields.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A signature models the declared property without a value initializer or
 *   implementation body; shared conversion owns the name policy.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Names do not select hidden types, and an absent annotation remains absent
 *   instead of being filled from a test's expected declaration.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc describes modifier, name, optional marker and annotation ordering;
 *   the native member example and argument descriptions match those fields.
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
