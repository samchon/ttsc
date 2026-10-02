import type {
  Expression,
  Identifier,
  ModifierLike,
  ParameterDeclaration,
  Token,
  TypeNode,
} from "../../ast";
import { asName } from "../internal/asName";
import { make } from "../internal/make";

/**
 * Create a {@link ParameterDeclaration}: a single function or method parameter.
 *
 * The `modifiers` precede the parameter name. On a constructor these are the
 * accessibility keywords such as `public` or `readonly` that turn it into a
 * parameter property; any decorators among them stay inline, in front of the
 * name, rather than moving to their own line. The `dotDotDotToken` marks a rest
 * parameter (`...args`), and the `questionToken` marks it optional (`name?`).
 *
 * The `name` accepts a string or an identifier. Binding-pattern names are not
 * represented by this outline signature. The optional `type` prints
 * after a colon, and the optional `initializer` supplies a default value after
 * an `=`.
 *
 * Given a `readonly` modifier, the name `value`, and a `number` type, the
 * printed parameter is:
 *
 * ```ts
 * readonly value: number
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The outline retains modifiers, rest/optional markers, type and initializer
 *   as distinct grammar slots. asName normalizes string names to Identifier;
 *   destructuring names and invalid marker combinations are not validated here.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Parameter syntax remains one node; constructor ownership determines whether
 *   its modifiers describe a parameter property instead of a second node shape.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   All marker/type/default decisions come from arguments, with unsupported
 *   binding-pattern names stated rather than cast into the identifier slot.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains constructor properties, inline decorators, rest and
 *   optional markers, and the identifier-name limit in separate paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param dotDotDotToken The rest marker (`...`), if any.
 * @param name The name.
 * @param questionToken The optional marker (`?`), if any.
 * @param type The type.
 * @param initializer The initializer, if any.
 * @returns The created {@link ParameterDeclaration}.
 */
export const createParameterDeclaration = (
  modifiers: readonly ModifierLike[] | undefined,
  dotDotDotToken: Token | undefined,
  name: string | Identifier,
  questionToken?: Token,
  type?: TypeNode,
  initializer?: Expression,
): ParameterDeclaration =>
  make("ParameterDeclaration", {
    modifiers,
    dotDotDotToken,
    name: asName(name),
    questionToken,
    type,
    initializer,
  });
