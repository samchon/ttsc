import { type ResidentCheckRequest } from "../ResidentCheckRequest";
import type { ResidentCheckEntryPlan } from "./ResidentCheckEntryPlan";

/**
 * Retain changes separately for each resident check's configuration position.
 * Duplicate entries may share a sidecar while still needing independent
 * delivery; an earlier failure must not consume a later entry's pending edits.
 * Existing path sets are merged and invalidation is sticky until consumption.
 *
 * @evidence contracts/common.md#principled-implementation Entry-indexed buffers preserve delivery to every configured check even when process keys coincide; set union and boolean OR retain all pending changes.
 * @evidence contracts/common.md#clear-and-simple-design The outer loop selects resident entries and one private merger owns canonical request construction; process sharing remains separate from delivery ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Buffering follows configured positions rather than deduplicating plugin executions to hide failures; inputs are not patched or mutated.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains duplicate-entry delivery, failure effects and sticky invalidation with separate prose and acknowledgment blocks.
 * @evidence contracts/performance.md#efficient-algorithms Set union eliminates repeated membership scans; each resident entry sorts its combined unique paths, costing O(P log P) for P pending paths.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This buffer preserves delivery data rather than coordinating shared computation; each configured effectful check still runs separately when due.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the pending map, with one slot per configured resident entry; consumption or session reset releases it, while unique paths can grow without a bound if an earlier check keeps failing.
 */
export function bufferResidentCheckEntryRequests(
  pending: Map<number, ResidentCheckRequest>,
  checks: readonly ResidentCheckEntryPlan[],
  request: ResidentCheckRequest,
): void {
  for (const check of checks) {
    if (check.key === undefined) continue;
    pending.set(
      check.entryIndex,
      mergeResidentCheckRequests(pending.get(check.entryIndex), request),
    );
  }
}

function mergeResidentCheckRequests(
  previous: ResidentCheckRequest | undefined,
  current: ResidentCheckRequest,
): ResidentCheckRequest {
  const merge = (
    left: readonly string[] | undefined,
    right: readonly string[] | undefined,
  ): string[] => [...new Set([...(left ?? []), ...(right ?? [])])].sort();
  const changed = merge(previous?.changed, current.changed);
  const external = merge(previous?.external, current.external);
  return {
    ...(changed.length === 0 ? {} : { changed }),
    ...(external.length === 0 ? {} : { external }),
    ...(previous?.invalidate === true || current.invalidate === true
      ? { invalidate: true }
      : {}),
  };
}
