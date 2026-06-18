import type { Node } from "../Node";

/**
 * A statement placeholder that is intentionally not emitted. It emits nothing.
 *
 * Built by {@link factory.createNotEmittedStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NotEmittedStatement {
  /** Discriminant tag; always `"NotEmittedStatement"`. */
  kind: "NotEmittedStatement";

  /** The original node this placeholder replaces, if any. */
  original?: Node;
}
