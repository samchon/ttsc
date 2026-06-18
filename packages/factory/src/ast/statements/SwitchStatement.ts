import type { Expression } from "../expressions/Expression";
import type { CaseBlock } from "./CaseBlock";

/**
 * A `switch` statement.
 *
 * Built by {@link factory.createSwitchStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SwitchStatement {
  /** Discriminant tag; always `"SwitchStatement"`. */
  kind: "SwitchStatement";

  /** Expression. */
  expression: Expression;

  /** CaseBlock. */
  caseBlock: CaseBlock;
}
