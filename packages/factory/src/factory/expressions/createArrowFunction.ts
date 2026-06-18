import type {
  ArrowFunction,
  Block,
  Expression,
  ModifierLike,
  ParameterDeclaration,
  Token,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ArrowFunction}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The type.
 * @param _equalsGreaterThanToken Ignored; present only to mirror the legacy
 *   signature.
 * @param body The body.
 * @returns The created {@link ArrowFunction}.
 */
export const createArrowFunction = (
  modifiers: readonly ModifierLike[] | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
  _equalsGreaterThanToken: Token | undefined,
  body: Block | Expression,
): ArrowFunction =>
  make("ArrowFunction", { modifiers, typeParameters, parameters, type, body });
