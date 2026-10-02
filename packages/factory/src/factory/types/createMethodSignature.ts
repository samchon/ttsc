import type {
  MethodSignature,
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
 * Create a {@link MethodSignature}: a `name(params): T` method signature for an
 * interface or type literal.
 *
 * Any modifiers print first, then the name, then a `?` when the question token
 * is present, then optional type parameters as `<...>`, the parameter list, and
 * the return type as `: Type` when present. A string name is normalized to a
 * property name node.
 *
 * Given the name `greet`, one `name: string` parameter, and a `void` return
 * type, the printer renders:
 *
 * ```ts
 * greet(name: string): void
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Property-name normalization preserves node names and converts strings;
 *   modifiers, optionality, generics, parameters and return annotation retain
 *   separate method-member roles without introducing a body.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Shared name conversion avoids a second naming policy, while one signature
 *   node represents the supported optional and generic combinations.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Method names never trigger alternate signatures, and missing return types
 *   are not fabricated to satisfy an expected declaration.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs describe modifier/name/optional/return order and provide
 *   a method-member example; every retained argument is documented.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param name The method name.
 * @param questionToken The optional marker (`?`), if any.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type, if any.
 * @returns The created {@link MethodSignature}.
 */
export const createMethodSignature = (
  modifiers: readonly ModifierLike[] | undefined,
  name: string | PropertyName,
  questionToken: Token | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
): MethodSignature =>
  make("MethodSignature", {
    modifiers,
    name: asPropertyName(name),
    questionToken,
    typeParameters,
    parameters,
    type,
  });
