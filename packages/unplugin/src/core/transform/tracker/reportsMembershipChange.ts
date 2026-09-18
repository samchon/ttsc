import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/**
 * Report whether the project walk observed a membership event. This is positive
 * evidence that the program's root set changed, so it outranks the question of
 * whether the notifications still work.
 *
 * Host and resolution-candidate trackers cover the union of every module's
 * inputs. Their events remain path witnesses: the requested module's narrow
 * validation decides whether that path is relevant. Promoting one of them to a
 * project-wide verdict would discard a generation when an unreachable external
 * input changes, defeating per-file completeness and doing needless compiles.
 */
export function reportsMembershipChange(
  cached: TtscCachedProjectTransform,
): boolean {
  return cached.projectMutationTracker?.membershipChanged === true;
}
