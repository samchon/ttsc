import type { Statement } from "./Statement";

/**
 * A brace-delimited block of statements.
 *
 * Built by {@link factory.createBlock}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface Block {
  /** Discriminant tag; always `"Block"`. */
  kind: "Block";

  /** The statements. */
  statements: readonly Statement[];

  /** When `true`, print one entry per line. */
  multiLine?: boolean;
}
