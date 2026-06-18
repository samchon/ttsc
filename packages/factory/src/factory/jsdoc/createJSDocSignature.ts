import type {
  JSDocParameterTag,
  JSDocReturnTag,
  JSDocSignature,
  JSDocTemplateTag,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocSignature}: the synthetic signature behind `@callback`
 * and `@overload` tags.
 *
 * The `typeParameters` are the `@template` tags, `parameters` are the `@param`
 * tags, and `type` is the `@returns` tag. The printer emits each on its own
 * line, in that order.
 *
 * With no type parameters, a single `@param {number} x the x` tag, and an
 * `@returns {boolean}` tag, the printer emits:
 *
 * ```ts
 * @param {number} x the x
 * @returns {boolean}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param typeParameters The `@template` type parameters, if any.
 * @param parameters The `@param` tags.
 * @param type The `@return` tag, if any.
 * @returns The created {@link JSDocSignature}.
 */
export const createJSDocSignature = (
  typeParameters: readonly JSDocTemplateTag[] | undefined,
  parameters: readonly JSDocParameterTag[],
  type?: JSDocReturnTag,
): JSDocSignature =>
  make("JSDocSignature", {
    typeParameters,
    parameters,
    type,
  });
