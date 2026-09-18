import path from "node:path";

import { type ResidentCheckRequest } from "../ResidentCheckRequest";
import type { ResidentCheckWatchChange } from "./ResidentCheckWatchChange";

/**
 * Translate one watch change into the line a resident check sidecar receives.
 *
 * Paths are resolved against `cwd`, deduplicated, and sorted, so two cycles
 * that observed the same edits in a different order send identical requests.
 * `reload` is not part of the wire protocol: the session handles it by
 * discarding its processes before any request is sent.
 */
export function residentCheckRequest(
  change: ResidentCheckWatchChange,
  cwd: string,
): ResidentCheckRequest {
  const normalize = (values: readonly string[] | undefined): string[] =>
    [...new Set(values?.map((value) => path.resolve(cwd, value)) ?? [])].sort();
  const changed = normalize(change.changed);
  const external = normalize(change.external);
  return {
    ...(change.invalidate === true ? { invalidate: true } : {}),
    ...(changed.length === 0 ? {} : { changed }),
    ...(external.length === 0 ? {} : { external }),
  };
}
