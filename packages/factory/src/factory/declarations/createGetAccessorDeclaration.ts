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
 * Create a {@link GetAccessorDeclaration}: a `get x() { ... }` accessor.
 *
 * The `modifiers` precede the `get` keyword, so a `public` modifier prints
 * `public get`. The `name` is the accessor key. A getter takes no value
 * parameter, so `parameters` is normally empty; the optional `type` is the
 * return type printed after the colon, and the `body` block holds the
 * statements using that block's `multiLine` layout policy. An omitted body
 * creates a bodyless accessor signature ending with a semicolon.
 *
 * Given a `public` modifier, the name `value`, a `number` return type, and a
 * body returning `this._value`, the printed accessor is:
 *
 * ```ts
 * public get value(): number {
 *   return this._value;
 * }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Property-name normalization preserves the accessor key and the node keeps
 *   return type/body. Callers must supply getter-valid parameters, normally none.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Getter-specific return typing stays here while shared parameter and Block
 *   builders own their subtrees; no setter policy is embedded.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The accessor is source syntax rather than an installed property descriptor.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains getter arity, return type and body, with the public
 *   accessor example separated from acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
