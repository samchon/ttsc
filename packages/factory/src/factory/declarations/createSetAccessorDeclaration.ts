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
 * Create a {@link SetAccessorDeclaration}.
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
