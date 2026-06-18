import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";
import type { TemplateLiteral } from "./TemplateLiteral";

/**
 * A tagged template, e.g. `tag`text``.
 *
 * Built by {@link factory.createTaggedTemplateExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TaggedTemplateExpression {
  /** Discriminant tag; always `"TaggedTemplateExpression"`. */
  kind: "TaggedTemplateExpression";

  /** Tag. */
  tag: Expression;

  /** TypeArguments. */
  typeArguments?: readonly TypeNode[];

  /** Template. */
  template: TemplateLiteral;
}
