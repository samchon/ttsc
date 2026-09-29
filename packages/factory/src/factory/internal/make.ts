import type { Node } from "../../ast";

/**
 * Construct an outline node of the given `kind`.
 *
 * The discriminant selects the concrete node interface so normal typed callers
 * supply that interface's required fields and receive its specific return type.
 * The final assertion restores the relationship TypeScript cannot express for
 * a generic object spread; it does not perform runtime validation or guarantee
 * excess-property rejection for structurally assignable nonliteral inputs.
 *
 * A fresh shallow object retains the supplied child references. Factory callers
 * supply props without a kind field, as the signature requires; runtime-invalid
 * values outside that typed contract are not sanitized by hidden fallbacks.
 *
 * @internal
 */
export const make = <K extends Node["kind"]>(
  kind: K,
  props: Omit<Extract<Node, { kind: K }>, "kind">,
): Extract<Node, { kind: K }> =>
  ({ kind, ...props }) as Extract<Node, { kind: K }>;
