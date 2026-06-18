import type { DefaultClause, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link DefaultClause}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @returns The created {@link DefaultClause}.
 */
export const createDefaultClause = (
  statements: readonly Statement[],
): DefaultClause => make("DefaultClause", { statements });
