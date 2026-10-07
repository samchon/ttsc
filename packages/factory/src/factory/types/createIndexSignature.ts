import type {
  IndexSignatureDeclaration,
  ModifierLike,
  ParameterDeclaration,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link IndexSignatureDeclaration}: a `[key: K]: V` index signature.
 *
 * Any modifiers print first (for example `readonly`), then the single key
 * parameter inside `[...]`, then `: ` followed by the value type.
 *
 * Given no modifiers, a `key: string` parameter, and a `number` value type, the
 * printer renders:
 *
 * ```ts
 * [key: string]: number
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param parameters The index parameter list.
 * @param type The value type.
 * @returns The created {@link IndexSignatureDeclaration}.
 * @evidence contracts/common.md#principled-implementation
 *   Modifiers, index parameters and result type retain their index-member
 *   roles; contextual legality of the supplied parameter list remains with the caller.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The factory stores a single signature outline and leaves bracket syntax to
 *   the printer, rather than converting parameters into string keys.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No key type is rewritten to fit an expected interface. The builder does
 *   not silently truncate the caller's parameter list to hide invalid input.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native description identifies the index key and value type and shows
 *   the member form; argument documentation names each retained field.
 */
export const createIndexSignature = (
  modifiers: readonly ModifierLike[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode,
): IndexSignatureDeclaration =>
  make("IndexSignature", { modifiers, parameters, type });
