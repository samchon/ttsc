import type { Identifier } from "../names/Identifier";
import type { ExpressionWithTypeArguments } from "../types/ExpressionWithTypeArguments";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@implements` JSDoc tag.
 *
 * Built by {@link factory.createJSDocImplementsTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocImplementsTag {
  /** Discriminant tag; always `"JSDocImplementsTag"`. */
  kind: "JSDocImplementsTag";

  /** The tag name, e.g. `implements`. */
  tagName: Identifier;

  /** The implemented class. */
  class: ExpressionWithTypeArguments;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
