import type { Node, NotEmittedStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NotEmittedStatement}: a placeholder without its own syntax body.
 *
 * This is a synthetic statement that occupies a slot in the tree but has no
 * syntax body. The optional `original` retains a reference to the replaced node.
 * The printer does not inherit that node's comments or source metadata through
 * this reference.
 *
 * Standalone and statement-list output is empty apart from synthetic comments
 * attached directly to this placeholder. Embedded statement positions, such as
 * a loop body or an if branch, instead print `;` to preserve the required empty
 * statement. The original reference does not decide either form.
 *
 * @evidence contracts/common.md#principled-implementation
 *   NotEmittedStatement marks a placeholder and retains original as metadata.
 *   Embedded contexts emit an empty semicolon while list/standalone contexts
 *   emit no syntax; original does not propagate comments or positions.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The placeholder records provenance without duplicating the original tree
 *   or manufacturing replacement source text.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Non-emission is this API's declared meaning, not a hidden failure fallback.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose distinguishes list/standalone emptiness from embedded empty
 *   statements and explicitly attached comments, and states the original-field limitation.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param original The original node this placeholder replaces, if any.
 * @returns The created {@link NotEmittedStatement}.
 */
export const createNotEmittedStatement = (
  original?: Node,
): NotEmittedStatement => make("NotEmittedStatement", { original });
