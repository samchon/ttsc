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
 * Arrays and tag nodes are retained by reference. The constructor does not
 * compare their names or types with an executable function.
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
 * @evidence contracts/common.md#principled-implementation Direct assignments retain the template, parameter and optional return tag roles, whose printer order expresses a documentation signature without checking executable-function correspondence.
 * @evidence contracts/common.md#clear-and-simple-design The constructor exposes three signature roles rather than another flattened tag list or a generic signature-building layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied tag sequence is not replaced by a known callback shape or reconciled through foreign declaration patches.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes template/parameter/return ordering, retained references and the validation boundary with an example; paragraphs and native tags follow the documentation guidance.
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
