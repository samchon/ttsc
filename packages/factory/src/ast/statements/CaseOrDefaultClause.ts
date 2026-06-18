import type { CaseClause } from "./CaseClause";
import type { DefaultClause } from "./DefaultClause";

/**
 * A `case` or `default` clause of a `switch`.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type CaseOrDefaultClause = CaseClause | DefaultClause;
