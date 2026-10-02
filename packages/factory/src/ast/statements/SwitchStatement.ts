import type { Expression } from "../expressions/Expression";
import type { CaseBlock } from "./CaseBlock";

/**
 * A `switch` statement.
 *
 * Built by {@link factory.createSwitchStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Subject Expression and CaseBlock preserve switch operand roles without evaluating matches or enforcing default uniqueness.
 * @evidence contracts/common.md#clear-and-simple-design The switch owns its subject; CaseBlock owns ordered clauses and their bodies.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The subject and clauses are caller data rather than precomputed fixture answers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies switch syntax and distinguishes subject from clause block; member spacing follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SwitchStatement {
  /** Discriminant tag; always `"SwitchStatement"`. */
  kind: "SwitchStatement";

  /** Value expression tested by the switch clauses. */
  expression: Expression;

  /** Ordered case/default clauses inside the switch braces. */
  caseBlock: CaseBlock;
}
