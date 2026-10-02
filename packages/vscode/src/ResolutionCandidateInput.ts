/**
 * Optional active file, owning workspace root and workspace roots used to
 * order resolution candidates.
 *
 * An absent active file leaves workspace-only discovery; an absent active
 * workspace root permits the normal ancestor search.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional activeFile and activeWorkspaceRoot allow workspace-only
 *   discovery without inventing an active document. Ordered workspaceRoots
 *   retain the caller's fallback priority.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This input separates editor selection from native discovery and carries
 *   only paths and ordering needed to construct resolution candidates.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc explains optional active-file and workspace-boundary inputs
 *   and ordered workspace fallbacks; the type comment states absent-input
 *   meaning. Purpose, conditions and reasons use separate native paragraphs
 *   under the documentation skill; member comments remain beside their
 *   fields.
  *
  * @evidenceExclude contracts/portability.md#os-neutral-implementation
  *   ResolutionCandidateInput only describes values and opens no file, path or
  *   process.
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   ResolutionCandidateInput is a type definition with no computation to cost.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   ResolutionCandidateInput is a type definition and coordinates no work
  *   across requests.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   ResolutionCandidateInput is a type definition and owns no state, handle or
  *   task.
 */
export type ResolutionCandidateInput = {
  /** Active file path; absence uses only the supplied workspace roots. */
  activeFile?: string;

  /** Owning workspace boundary passed to active-file project discovery. */
  activeWorkspaceRoot?: string;

  /** Workspace directories considered after the active file. */
  workspaceRoots?: readonly string[];
};
