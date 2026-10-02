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
 * follows after a colon, and the optional `body` block holds the statements.
 * Block's `multiLine` flag controls forced versus width-dependent layout;
 * omitting the body creates a signature ending with a semicolon.
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
 * @evidence contracts/common.md#principled-implementation
 *   Optional name/body preserve anonymous or bodyless forms; generator token,
 *   generics, ordered parameters and return type retain independent grammar slots.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The declaration groups function-level syntax; child parameter/type/block
 *   builders own contents and asName owns string normalization.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No implementation body is fabricated for a signature-only declaration.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc distinguishes generator and anonymous forms and signature/body pieces
 *   in separate paragraphs with a concrete function example before tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
