import type { Token } from "../names/Token";
import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * An optional call, e.g. `a?.()`.
 *
 * Built by {@link factory.createCallChain}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CallChain {
  /** Discriminant tag; always `"CallChain"`. */
  kind: "CallChain";

  /** Expression. */
  expression: Expression;

  /** QuestionDotToken. */
  questionDotToken?: Token;

  /** TypeArguments. */
  typeArguments?: readonly TypeNode[];

  /** Arguments. */
  arguments: readonly Expression[];
}
