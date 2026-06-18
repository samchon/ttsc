import type { CaseBlock, CaseOrDefaultClause } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link CaseBlock}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param clauses The clauses.
 * @returns The created {@link CaseBlock}.
 */
export const createCaseBlock = (
  clauses: readonly CaseOrDefaultClause[],
): CaseBlock => make("CaseBlock", { clauses });
