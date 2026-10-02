/**
 * What changed on disk since the previous watch cycle, as the watch launcher
 * classified it for {@link ResidentCheckWatchSession.run}.
 *
 * The fields distinguish effect scope. `reload` resets selected execution and
 * sidecars; `invalidate` keeps that selection but requests a cold Program.
 * Known source paths can update a warm Program incrementally. A declared
 * external path outside that Program remains data-only; an unknown undeclared
 * path invalidates the Program. An empty change requests another check without
 * reporting an edit; it does not certify unchanged files.
 *
 * @evidence contracts/common.md#principled-implementation Reload, invalidation and incremental path lists encode different watch effects; optional fields permit a check request that reports no edit without certifying current filesystem equality.
 * @evidence contracts/common.md#clear-and-simple-design One change record exposes the coordinator's effect hierarchy without embedding sidecar lifecycle or compiler implementation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation names actual watch actions and declared input classes rather than consumer-specific sentinel paths.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains effect precedence and empty changes; each documented member has its own separated comment.
 * @evidence contracts/portability.md#os-neutral-implementation Changed and external paths are native filesystem inputs normalized against the selected execution's project root by the wire adapter; the type does not imply case equivalence from an OS name.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
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
