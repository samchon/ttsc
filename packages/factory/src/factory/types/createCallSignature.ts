import type {
  CallSignatureDeclaration,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CallSignatureDeclaration}: a `(params): ReturnType` call
 * signature for an interface or type literal.
 *
 * Optional type parameters print first as `<...>`, then the parameter list,
 * then the return type as `: Type` when present.
 *
 * Given one `x: number` parameter and a `string` return type, the printer
 * renders:
 *
 * ```ts
 * (x: number): string
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Ordered type parameters and parameters populate a CallSignature, with an
 *   optional return type. Its member role does not introduce a function name or body.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The signature retains its three required concerns as fields, while the
 *   containing interface or type literal owns member separators.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Omitted return types stay omitted; no inferred annotation or fixture-only
 *   parameter rewrite is inserted to force a desired signature.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the member context and optional generics/return type, with
 *   a standalone signature example and the actual declaration type linked.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type, if any.
 * @returns The created {@link CallSignatureDeclaration}.
 */
export const createCallSignature = (
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
): CallSignatureDeclaration =>
  make("CallSignature", { typeParameters, parameters, type });
