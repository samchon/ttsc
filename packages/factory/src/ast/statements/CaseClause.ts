import type { Expression } from "../expressions/Expression";
import type { Statement } from "./Statement";

/**
 * A `case` clause of a `switch`.
 *
 * Built by {@link factory.createCaseClause}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CaseClause {
  /** Discriminant tag; always `"CaseClause"`. */
  kind: "CaseClause";

  /** Expression. */
  expression: Expression;

  /** Statements. */
  statements: readonly Statement[];
}
