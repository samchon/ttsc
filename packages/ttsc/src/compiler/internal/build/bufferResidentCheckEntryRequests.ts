import { type ResidentCheckRequest } from "../ResidentCheckRequest";
import type { ResidentCheckEntryPlan } from "./ResidentCheckEntryPlan";

/** Retain one complete change stream per configured resident check entry. */
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
