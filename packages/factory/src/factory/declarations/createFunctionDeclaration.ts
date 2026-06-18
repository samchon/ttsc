import type {
  Block,
  FunctionDeclaration,
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
 * Create a {@link FunctionDeclaration}: a `function f(...) { ... }`.
 *
 * The `modifiers` precede the `function` keyword, so an `export` modifier
 * prints `export function` and an `async` modifier prints `async function`. The
 * `asteriskToken`, when present, marks the function as a generator
 * (`function*`). The `name` may be omitted for the anonymous form used by
 * `export default`, and `typeParameters` add the generic `<...>` list.
 *
 * The `parameters` print inside the parentheses, the optional return `type`
 * follows after a colon, and the `body` block holds the statements, indented
 * one per line.
 *
 * Given an `export` modifier, the name `add`, two `number` parameters `a` and
 * `b`, a `number` return type, and a body returning `a + b`, the printed
 * declaration is:
 *
 * ```ts
 * export function add(a: number, b: number): number {
 *   return a + b;
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param asteriskToken The generator marker (`*`), if any.
 * @param name The name.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The type.
 * @param body The body.
 * @returns The created {@link FunctionDeclaration}.
 */
export const createFunctionDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  asteriskToken: Token | undefined,
  name: string | Identifier | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
  body: Block | undefined,
): FunctionDeclaration =>
  make("FunctionDeclaration", {
    modifiers,
    asteriskToken,
    name: name === undefined ? undefined : asName(name),
    typeParameters,
    parameters,
    type,
    body,
  });
