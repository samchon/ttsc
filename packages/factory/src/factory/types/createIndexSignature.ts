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
 */
export const createIndexSignature = (
  modifiers: readonly ModifierLike[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode,
): IndexSignatureDeclaration =>
  make("IndexSignature", { modifiers, parameters, type });
