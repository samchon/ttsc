import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/** Create an empty bounded witness collection for one transform attempt. */
export function createGenerationProofFailures(): TtscGenerationProofFailures {
  return { entries: [], omitted: 0, seen: new Set() };
}
