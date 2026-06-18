/**
 * An empty statement (a lone `;`).
 *
 * Built by {@link factory.createEmptyStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface EmptyStatement {
  /** Discriminant tag; always `"EmptyStatement"`. */
  kind: "EmptyStatement";
}
