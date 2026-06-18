import type { JSDocParameterTag } from "./JSDocParameterTag";
import type { JSDocReturnTag } from "./JSDocReturnTag";
import type { JSDocTemplateTag } from "./JSDocTemplateTag";

/**
 * A JSDoc signature, used as the type of `@callback` and `@overload` tags.
 *
 * Built by {@link factory.createJSDocSignature}.
 *
 * @author Jeongho Nam - https://github.com/samchon
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
