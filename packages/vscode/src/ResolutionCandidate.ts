/**
 * A module-resolution base, server working directory and optional selected
 * project config.
 *
 * Resolution and server cwd may differ when an active file lives below its
 * project root.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Keeping resolveFrom distinct from cwd lets a nested source resolve its
 *   package while its server uses the owning config directory. Optional
 *   tsconfig distinguishes explicit selection from launcher discovery.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   These three fields express resolution and launch inputs together without
 *   retaining editor state or performing resolution inside the value.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc distinguishes native module-resolution base, server cwd and
 *   optional config; the type comment explains why base and cwd can differ.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
  *
  * @evidence contracts/portability.md#os-neutral-implementation
  *   resolveFrom, cwd and optional tsconfig carry native filesystem paths,
  *   separating Node package resolution from the server working directory.
  *   The record preserves path spelling; the owning planner observes physical
  *   identity rather than inferring equivalence from OS names or letter case.
  *
  * @evidenceExclude contracts/performance.md#efficient-algorithms
  *   ResolutionCandidate is a type definition with no computation to cost.
  *
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work
  *   ResolutionCandidate is a type definition and coordinates no work across
  *   requests.
  *
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
  *   ResolutionCandidate is a type definition and owns no state, handle or
  *   task.
 */
export type ResolutionCandidate = {
  /** Working directory for project-owned server execution. */
  cwd: string;

  /** Directory from which Node resolves the project's ttsc package. */
  resolveFrom: string;

  /** Selected config candidate; absence leaves launcher discovery enabled. */
  tsconfig?: string;
};
