import type { Expression } from "../expressions/Expression";
import type { Token } from "../names/Token";
import type { ForInitializer } from "./ForInitializer";
import type { Statement } from "./Statement";

/**
 * A `for...of` statement (optionally `for await`).
 *
 * Built by {@link factory.createForOfStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ForOfStatement {
  /** Discriminant tag; always `"ForOfStatement"`. */
  kind: "ForOfStatement";

  /** AwaitModifier. */
  awaitModifier?: Token;

  /** Initializer. */
  initializer: ForInitializer;

  /** Expression. */
  expression: Expression;

  /** Statement. */
  statement: Statement;
}
