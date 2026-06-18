import type { Node } from "../../ast";

/**
 * Construct an outline node of the given `kind`.
 *
 * Generic over the node kind, so the `props` object is type-checked against the
 * exact node interface (every required field present, no stray fields, correct
 * types) and the return type is the concrete node — the factory is type-safe
 * end to end.
 *
 * @internal
 */
export const make = <K extends Node["kind"]>(
  kind: K,
  props: Omit<Extract<Node, { kind: K }>, "kind">,
): Extract<Node, { kind: K }> =>
  ({ kind, ...props }) as Extract<Node, { kind: K }>;
