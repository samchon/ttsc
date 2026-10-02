import type {
  FunctionTypeNode,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link FunctionTypeNode}: a `(params) => T` function type.
 *
 * Optional type parameters print first as `<...>`, then the parameter list,
 * then `=>` followed by the return type. In postfix and array positions the
 * surrounding printer wraps a function type in parentheses, since `() => T[]`
 * would otherwise mean a function returning an array rather than an array of functions.
 *
 * Given one `x: number` parameter and a `string` return type, the printer
 * renders:
 *
 * ```ts
 * (x: number) => string
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   FunctionTypeNode records generic parameters, ordered value parameters and
 *   a required return type; the printer distinguishes => from member : syntax.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The callable type needs no executable body or declaration name. Child
 *   nodes remain structured so surrounding type constructs can group them.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Return and parameter types are not replaced by pre-rendered arrow text or
 *   inferred from particular parameter names.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains the function type's syntax and grouping context; the
 *   example represents a type node without a statement-only semicolon.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type.
 * @returns The created {@link FunctionTypeNode}.
 */
export const createFunctionTypeNode = (
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode,
): FunctionTypeNode =>
  make("FunctionTypeNode", { typeParameters, parameters, type });
