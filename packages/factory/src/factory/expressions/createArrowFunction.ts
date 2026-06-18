import type {
  ArrowFunction,
  Block,
  Expression,
  ModifierLike,
  ParameterDeclaration,
  Token,
  TypeNode,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ArrowFunction}: a `(params) => body` arrow function.
 *
 * The `body` is either a {@link Block} for a statement body or an
 * {@link Expression} for a concise body. The optional `modifiers`,
 * `typeParameters` and return `type` are printed when present. The
 * `_equalsGreaterThanToken` parameter exists only for signature parity with the
 * legacy factory and is ignored: the printer always emits `=>` between the
 * parameter list and the body.
 *
 * Given one parameter `x` and a concise body of `x`, the printer emits:
 *
 * ```ts
 * (x) => x;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param modifiers The leading modifiers and decorators, if any.
 * @param typeParameters The generic type parameters, if any.
 * @param parameters The parameters.
 * @param type The return type, if any.
 * @param _equalsGreaterThanToken Ignored; present only to mirror the legacy
 *   signature.
 * @param body The block or expression body.
 * @returns The created {@link ArrowFunction}.
 */
export const createArrowFunction = (
  modifiers: readonly ModifierLike[] | undefined,
  typeParameters: readonly TypeParameterDeclaration[] | undefined,
  parameters: readonly ParameterDeclaration[],
  type: TypeNode | undefined,
  _equalsGreaterThanToken: Token | undefined,
  body: Block | Expression,
): ArrowFunction =>
  make("ArrowFunction", { modifiers, typeParameters, parameters, type, body });
