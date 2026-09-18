/**
 * What changed on disk since the previous watch cycle, as the watch launcher
 * classified it for {@link ResidentCheckWatchSession.run}.
 *
 * The fields are ordered by cost. `reload` discards everything the session
 * holds; `invalidate` keeps the processes but reloads their Programs; `changed`
 * and `external` let a warm Program update incrementally. An empty change
 * re-runs the check on unchanged state.
 */
export type ResidentCheckWatchChange = {
  /** Re-resolve project, plugin, contributor, and Program topology. */
  reload?: boolean;
  /** Retain the sidecar and execution selection but cold-load its Program. */
  invalidate?: boolean;
  /** Local compiler or data paths changed since the prior cycle. */
  changed?: readonly string[];
  /** Subset of changed paths declared by ProjectRules as external inputs. */
  external?: readonly string[];
};
