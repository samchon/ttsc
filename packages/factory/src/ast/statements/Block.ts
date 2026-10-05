import type { Statement } from "./Statement";

/**
 * A brace-delimited block of statements.
 *
 * Built by {@link factory.createBlock}.
 *
 * Nonempty blocks break across lines by default or when multiLine is true.
 * Explicit false lets the printer keep a block inline when it fits the width.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation An ordered Statement list and brace-block kind preserve statement grouping, including explicitly non-emitted placeholders; multiLine chooses forced breaking versus width-based grouping without changing statement order.
 * @evidence contracts/common.md#clear-and-simple-design The block owns sequence and optional layout, while each Statement owns its syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Brace grouping and multiline policy are explicit syntax/layout choices rather than fixture-selected statement output.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes default forced breaking from explicit false width-based grouping; member separation follows the documentation skill.
 */
export interface Block {
  /** Discriminant tag; always `"Block"`. */
  kind: "Block";

  /** The statements. */
  statements: readonly Statement[];

  /**
   * True or absent forces breaking for a nonempty block; false allows inline
   * layout when it fits.
   */
  multiLine?: boolean;
}
