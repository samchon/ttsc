import type { Token } from "../names/Token";
import type { Expression } from "./Expression";

/**
 * An optional element access, e.g. `a?.[k]`.
 *
 * Built by {@link factory.createElementAccessChain}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ElementAccessChain {
  /** Discriminant tag; always `"ElementAccessChain"`. */
  kind: "ElementAccessChain";

  /** Expression. */
  expression: Expression;

  /** QuestionDotToken. */
  questionDotToken?: Token;

  /** ArgumentExpression. */
  argumentExpression: Expression;
}
