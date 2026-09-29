import type { Node } from "../Node";

/**
 * A statement placeholder that is intentionally not emitted. It emits nothing.
 *
 * Built by {@link factory.createNotEmittedStatement}.
 *
 * @evidence contracts/common.md#principled-implementation An explicit placeholder kind distinguishes suppressed syntax from EmptyStatement's semicolon; optional original retains provenance without being emitted.
 * @evidence contracts/common.md#clear-and-simple-design Only optional provenance accompanies the kind because the placeholder owns no executable statement payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Empty output is this published placeholder's contract, not a hidden fixture-specific deletion.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states non-emission and optional original-node meaning; member separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NotEmittedStatement {
  /** Discriminant tag; always `"NotEmittedStatement"`. */
  kind: "NotEmittedStatement";

  /** The original node this placeholder replaces, if any. */
  original?: Node;
}
