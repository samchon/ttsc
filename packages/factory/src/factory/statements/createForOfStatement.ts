import type {
  Expression,
  ForInitializer,
  ForOfStatement,
  Statement,
  Token,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ForOfStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param awaitModifier The awaitModifier.
 * @param initializer The initializer.
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link ForOfStatement}.
 */
export const createForOfStatement = (
  awaitModifier: Token | undefined,
  initializer: ForInitializer,
  expression: Expression,
  statement: Statement,
): ForOfStatement =>
  make("ForOfStatement", { awaitModifier, initializer, expression, statement });
