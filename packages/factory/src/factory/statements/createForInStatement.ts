import type {
  Expression,
  ForInStatement,
  ForInitializer,
  Statement,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ForInStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param initializer The initializer.
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link ForInStatement}.
 */
export const createForInStatement = (
  initializer: ForInitializer,
  expression: Expression,
  statement: Statement,
): ForInStatement =>
  make("ForInStatement", { initializer, expression, statement });
