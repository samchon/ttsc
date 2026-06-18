import type { Identifier } from "../names/Identifier";

/**
 * A `break` statement, optionally labeled.
 *
 * Built by {@link factory.createBreakStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface BreakStatement {
  /** Discriminant tag; always `"BreakStatement"`. */
  kind: "BreakStatement";

  /** Label. */
  label?: Identifier;
}
