/**
 * How much to trust a node or edge.
 *
 * Conventionally tracks {@link TtscGraphProvenance}: `checker-resolved` facts
 * are `high`, `framework-derived` relationships are `medium`, and `heuristic`
 * bridges are `low`. It is a separate axis so a producer can still mark an
 * especially certain derivation `high`, or downgrade an ambiguous one, without
 * changing how it was derived.
 */
export type TtscGraphConfidence = "high" | "medium" | "low";
