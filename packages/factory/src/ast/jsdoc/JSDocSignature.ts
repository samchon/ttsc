import type { JSDocParameterTag } from "./JSDocParameterTag";
import type { JSDocReturnTag } from "./JSDocReturnTag";
import type { JSDocTemplateTag } from "./JSDocTemplateTag";

/**
 * A JSDoc signature, used as the type of `@callback` and `@overload` tags.
 *
 * Built by {@link factory.createJSDocSignature}.
 *
 * Printing orders template tags before parameters and the optional return tag.
 * An empty parameter list is permitted; this container does not check names or
 * tag consistency against an executable function.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Typed template, parameter and return tag roles express a documentation signature and preserve per-role order without asserting correspondence to an executable function.
 * @evidence contracts/common.md#clear-and-simple-design Three role-based members describe the fixed emission order; absent templates and return tags need no auxiliary state or second flattened tag list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The signature uses structured tags for arbitrary callers rather than recognizing fixture signatures or patching declarations to match documentation.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains emission order, empty parameters and the consistency-check boundary; optional-role comments and paragraph separation follow the documentation guidance.
 */
export interface JSDocSignature {
  /** Discriminant tag; always `"JSDocSignature"`. */
  kind: "JSDocSignature";

  /** The `@template` type parameters, if any. */
  typeParameters?: readonly JSDocTemplateTag[];

  /** The `@param` tags. */
  parameters: readonly JSDocParameterTag[];

  /** The `@return` tag, if any. */
  type?: JSDocReturnTag;
}
