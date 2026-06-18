import type { Node, NotEmittedStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link NotEmittedStatement}: a placeholder that prints nothing.
 *
 * This is a synthetic statement that occupies a slot in the tree but produces
 * no output. The optional `original` records the node this placeholder stands
 * in for, so comments and source positions attached to it can still be carried
 * through.
 *
 * With any `original` (or none), the printed result is empty:
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param original The original node this placeholder replaces, if any.
 * @returns The created {@link NotEmittedStatement}.
 */
export const createNotEmittedStatement = (
  original?: Node,
): NotEmittedStatement => make("NotEmittedStatement", { original });
