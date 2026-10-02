import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@throws` JSDoc tag.
 *
 * Built by {@link factory.createJSDocThrowsTag}.
 *
 * An omitted type leaves an untyped failure description. Printing this tag
 * neither raises an error nor checks which errors a function can throw.
 *
 * @evidence contracts/common.md#principled-implementation An optional type expression and comment support typed or untyped failure documentation while separating annotated failure intent from actual thrown behavior.
 * @evidence contracts/common.md#clear-and-simple-design The payload records only tag spelling, an optional braced type and prose, with no exception-flow model or inferred error list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure documentation uses explicit caller data rather than injecting errors or recognizing known failure fixtures.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes missing-type behavior and the absence of raising or failure analysis; paragraph and member separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocThrowsTag {
  /** Discriminant tag; always `"JSDocThrowsTag"`. */
  kind: "JSDocThrowsTag";

  /** The tag name, e.g. `throws`. */
  tagName: Identifier;

  /** The type expression, if any. */
  typeExpression?: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
