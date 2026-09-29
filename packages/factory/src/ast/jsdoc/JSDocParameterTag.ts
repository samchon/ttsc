import type { EntityName } from "../names/EntityName";
import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@param` JSDoc tag.
 *
 * Built by {@link factory.createJSDocParameterTag}.
 *
 * isBracketed controls optional-name brackets, independently of type omission.
 * isNameFirst selects name-before-type or type-before-name notation. These
 * flags describe printed syntax and do not validate a function's parameters.
 *
 * @evidence contracts/common.md#principled-implementation A structured name, optional braced type and independent bracket and order flags represent both supported parameter notations without confusing syntactic optionality with executable parameter validation.
 * @evidence contracts/common.md#clear-and-simple-design Each flag controls one independent formatting distinction, while name and type remain reusable child nodes rather than alternate flattened tag strings.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Parameter syntax is caller data; the node neither recognizes expected test arguments nor rewrites a foreign function signature to match the annotation.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains independent optionality and ordering and the validation boundary; separated member comments and explanatory paragraphs follow the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocParameterTag {
  /** Discriminant tag; always `"JSDocParameterTag"`. */
  kind: "JSDocParameterTag";

  /** The tag name, e.g. `param`. */
  tagName: Identifier;

  /** The parameter name. */
  name: EntityName;

  /** Whether the name was wrapped in brackets (optional parameter). */
  isBracketed: boolean;

  /** Braced type annotation; omission retains the name and its brackets. */
  typeExpression?: JSDocTypeExpression;

  /** Whether the name was written before the type. */
  isNameFirst: boolean;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
