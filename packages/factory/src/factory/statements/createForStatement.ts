import type {
  Expression,
  ForInitializer,
  ForStatement,
  Statement,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ForStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param initializer The initializer.
 * @param condition The condition.
 * @param incrementor The incrementor.
 * @param statement The statement.
 * @returns The created {@link ForStatement}.
 */
export const createForStatement = (
  initializer: ForInitializer | undefined,
  condition: Expression | undefined,
  incrementor: Expression | undefined,
  statement: Statement,
): ForStatement =>
  make("ForStatement", { initializer, condition, incrementor, statement });
