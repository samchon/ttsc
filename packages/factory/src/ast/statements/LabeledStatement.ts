import type { Identifier } from "../names/Identifier";
import type { Statement } from "./Statement";

/**
 * A labeled statement, e.g. `outer: for (...) {}`.
 *
 * Built by {@link factory.createLabeledStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface LabeledStatement {
  /** Discriminant tag; always `"LabeledStatement"`. */
  kind: "LabeledStatement";

  /** Label. */
  label: Identifier;

  /** Statement. */
  statement: Statement;
}
