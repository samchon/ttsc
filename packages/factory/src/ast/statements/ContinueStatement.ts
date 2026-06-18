import type { Identifier } from "../names/Identifier";

/**
 * A `continue` statement, optionally labeled.
 *
 * Built by {@link factory.createContinueStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ContinueStatement {
  /** Discriminant tag; always `"ContinueStatement"`. */
  kind: "ContinueStatement";

  /** Label. */
  label?: Identifier;
}
