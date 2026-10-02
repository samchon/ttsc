import type {
  ConstructSignatureDeclaration,
  ParameterDeclaration,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ConstructSignatureDeclaration}: a `new (params): T` construct
 * signature for an interface or type literal.
 *
 * The `new ` keyword prints first, then optional type parameters as `<...>`,
 * the parameter list, and the return type as `: Type` when present.
 *
 * Given one `x: number` parameter and a `Foo` return type, the printer renders:
 *
 * ```ts
 * new (x: number): Foo
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The ConstructSignature discriminant distinguishes a new-call member from
 *   an ordinary call signature while preserving generics, parameters and return type.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The constructor describes one signature without creating a class, body or
 *   separate wrapper for optional generics and return annotations.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Supplied parameter and type nodes are retained; no constructor name lookup
 *   or expected-output special case fabricates the resulting signature.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The prose explains new, optional generics and return punctuation, and links
 *   the real ConstructSignatureDeclaration type rather than the internal kind.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type, if any.
 * @returns The created {@link ConstructSignatureDeclaration}.
 */
export const createConstructSignature = (
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
): ConstructSignatureDeclaration =>
  make("ConstructSignature", { typeParameters, parameters, type });
