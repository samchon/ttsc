import type {
  Block,
  MethodDeclaration,
  ModifierLike,
  ParameterDeclaration,
  PropertyName,
  Token,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { asPropertyName } from "../internal/asPropertyName";
import { make } from "../internal/make";

/**
 * Create a {@link MethodDeclaration}: a class method `m(...) { ... }`.
 *
 * The `modifiers` precede the method name, so a `public` modifier prints
 * `public m`, and `static` or `async` print likewise. Any decorators among the
 * modifiers are hoisted onto their own lines above the method. The
 * `asteriskToken` marks a generator method (`*m`), and the `questionToken`
 * marks an optional method (`m?`). The `name` is the method key, and
 * `typeParameters` add the generic `<...>` list.
 *
 * The `parameters` print inside the parentheses, the optional return `type`
 * follows after a colon, and the optional `body` block holds the statements.
 * Block's `multiLine` flag controls forced versus width-dependent layout;
 * omitting the body creates a signature ending with a semicolon.
 *
 * Given a `public` modifier, the name `greet`, a `name: string` parameter, a
 * `string` return type, and a body returning `name`, the printed method is:
 *
 * ```ts
 * public greet(name: string): string {
 *   return name;
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param asteriskToken The generator marker (`*`), if any.
 * @param name The name.
 * @param questionToken The optional marker (`?`), if any.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The type.
 * @param body The body.
 * @returns The created {@link MethodDeclaration}.
 * @evidence contracts/common.md#principled-implementation
 *   PropertyName permits named/computed methods while generator and optional
 *   markers remain separate; generic parameters, signature and body are retained.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Class-specific method syntax is one outline node. Name normalization is
 *   shared and parameter/type/body subtrees are not reconstructed here.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Modifiers describe emitted methods rather than replacing a class prototype.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain decorators, generator/optional markers and the
 *   signature/body split, with a method example and blank lines before tags.
 */
export const createMethodDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  asteriskToken: Token | undefined,
  name: string | PropertyName,
  questionToken: Token | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
  body: Block | undefined,
): MethodDeclaration =>
  make("MethodDeclaration", {
    modifiers,
    asteriskToken,
    name: asPropertyName(name),
    questionToken,
    typeParameters,
    parameters,
    type,
    body,
  });
