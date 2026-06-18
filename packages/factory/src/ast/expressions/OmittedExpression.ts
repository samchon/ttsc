/**
 * An elision (a hole) in an array literal or binding pattern.
 *
 * Built by {@link factory.createOmittedExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface OmittedExpression {
  /** Discriminant tag; always `"OmittedExpression"`. */
  kind: "OmittedExpression";
}
