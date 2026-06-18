import type { CaseOrDefaultClause } from "./CaseOrDefaultClause";

/**
 * The `{ ... }` body of a `switch` statement.
 *
 * Built by {@link factory.createCaseBlock}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CaseBlock {
  /** Discriminant tag; always `"CaseBlock"`. */
  kind: "CaseBlock";

  /** Clauses. */
  clauses: readonly CaseOrDefaultClause[];
}
