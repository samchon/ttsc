import type {
  Block,
  ModifierLike,
  ParameterDeclaration,
  PropertyName,
  SetAccessorDeclaration,
} from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";

/**
 * Create a {@link SetAccessorDeclaration}: a `set x(value) { ... }` accessor.
 *
 * The `modifiers` precede the `set` keyword, so a `public` modifier prints
 * `public set`. The `name` is the accessor key. A setter takes exactly one
 * value parameter, supplied through `parameters`, and has no return type. The
 * `body` block holds the statements, indented one per line.
 *
 * Given a `public` modifier, the name `value`, a single `value: number`
 * parameter, and a body assigning `this._value = value`, the printed accessor
 * is:
 *
 * ```ts
 * public set value(value: number) {
 *   this._value = value;
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The name.
 * @param parameters The parameters.
 * @param body The body.
 * @returns The created {@link SetAccessorDeclaration}.
 */
export const createSetAccessorDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | PropertyName,
  parameters: readonly ParameterDeclaration[],
  body: Block | undefined,
): SetAccessorDeclaration =>
  make("SetAccessorDeclaration", {
    modifiers,
    name: asPropertyName(name),
    parameters,
    body,
  });
