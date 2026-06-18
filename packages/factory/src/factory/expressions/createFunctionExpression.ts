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
 * Create a {@link FunctionExpression}: a `function` used as an expression.
 *
 * A string `name` is normalized with {@link asName}; the name is optional, as
 * are the `modifiers`, `asteriskToken` (the generator `*`), `typeParameters`
 * and return `type`. The `body` is a {@link Block}.
 *
 * Given name `f`, no parameters and an empty body, the printer emits:
 *
 * ```ts
 * function f() {}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param asteriskToken The generator marker (`*`), if any.
 * @param name The function name, if any.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type, if any.
 * @param body The block body.
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
