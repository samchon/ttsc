import type {
  ExpressionWithTypeArguments,
  Identifier,
  JSDocComment,
  JSDocImplementsTag,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocImplementsTag}: an `@implements` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `implements` when omitted. The
 * `className` is the implemented interface or class expression, which the
 * printer wraps in braces. The `comment` is the trailing description, if any.
 *
 * With the default tag name and an `Iface` class expression, the printer emits:
 *
 * ```ts
 * @implements {Iface}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `implements`.
 * @param className The implemented class.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocImplementsTag}.
 */
export const createJSDocImplementsTag = (
  tagName: Identifier | undefined,
  className: ExpressionWithTypeArguments,
  comment?: string | readonly JSDocComment[],
): JSDocImplementsTag =>
  make("JSDocImplementsTag", {
    tagName: tagName ?? createIdentifier("implements"),
    class: className,
    comment,
  });
