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
 * Create a {@link GetAccessorDeclaration}.
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
