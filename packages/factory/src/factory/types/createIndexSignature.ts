import type {
  IndexSignatureDeclaration,
  ModifierLike,
  ParameterDeclaration,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link IndexSignatureDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param parameters The parameters.
 * @param type The type.
 * @returns The created {@link IndexSignatureDeclaration}.
 */
export const createIndexSignature = (
  modifiers: readonly ModifierLike[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode,
): IndexSignatureDeclaration =>
  make("IndexSignature", { modifiers, parameters, type });
