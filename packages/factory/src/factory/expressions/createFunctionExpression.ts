import type {
  Block,
  FunctionExpression,
  Identifier,
  ModifierLike,
  ParameterDeclaration,
  Token,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link FunctionExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param asteriskToken The generator marker (`*`), if any.
 * @param name The name.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The type.
 * @param body The body.
 * @returns The created {@link FunctionExpression}.
 */
export const createFunctionExpression = (
  modifiers: readonly ModifierLike[] | undefined,
  asteriskToken: Token | undefined,
  name: string | Identifier | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
  body: Block,
): FunctionExpression =>
  make("FunctionExpression", {
    modifiers,
    asteriskToken,
    name: name === undefined ? undefined : asName(name),
    typeParameters,
    parameters,
    type,
    body,
  });
