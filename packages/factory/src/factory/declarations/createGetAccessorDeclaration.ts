import type {
  Block,
  GetAccessorDeclaration,
  ModifierLike,
  ParameterDeclaration,
  PropertyName,
  TypeNode,
} from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";

/**
 * Create a {@link GetAccessorDeclaration}: a `get x() { ... }` accessor.
 *
 * The `modifiers` precede the `get` keyword, so a `public` modifier prints
 * `public get`. The `name` is the accessor key. A getter takes no value
 * parameter, so `parameters` is normally empty; the optional `type` is the
 * return type printed after the colon, and the `body` block holds the
 * statements, indented one per line.
 *
 * Given a `public` modifier, the name `value`, a `number` return type, and a
 * body returning `this._value`, the printed accessor is:
 *
 * ```ts
 * public get value(): number {
 *   return this._value;
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param parameters The parameters.
 * @param type The type.
 * @param body The body.
 * @returns The created {@link GetAccessorDeclaration}.
 */
export const createGetAccessorDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | PropertyName,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
  body: Block | undefined,
): GetAccessorDeclaration =>
  make("GetAccessorDeclaration", {
    modifiers,
    name: asPropertyName(name),
    parameters,
    type,
    body,
  });
