import type { Statement } from "./Statement";

/**
 * The `default` clause of a `switch`.
 *
 * Built by {@link factory.createDefaultClause}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface DefaultClause {
  /** Discriminant tag; always `"DefaultClause"`. */
  kind: "DefaultClause";

  /** Statements. */
  statements: readonly Statement[];
}
