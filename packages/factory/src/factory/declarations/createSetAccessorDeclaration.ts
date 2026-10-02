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
 * optional `body` block holds the statements using its `multiLine` layout
 * policy; an omitted body ends the accessor signature with a semicolon.
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
 * @evidence contracts/common.md#principled-implementation
 *   Setter nodes keep their key, parameters and body without a return-type slot;
 *   the caller is responsible for the required one-value-parameter grammar.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Setter-specific shape is explicit while name normalization and body syntax
 *   remain shared helpers rather than duplicate accessor machinery.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No real object accessor is patched; the supplied body is emitted as source.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states one-parameter usage and absence of return typing with a separate
 *   assignment-body example, following documentation paragraph guidance.
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
