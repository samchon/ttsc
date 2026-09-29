/**
 * One watch cycle sent to a resident `check-serve` sidecar: the filesystem
 * transitions since the previous cycle, and nothing else.
 *
 * The sidecar keeps its Program warm across cycles. Each field tells it how
 * much of that Program the change can have affected; an empty request re-runs
 * the check on the unchanged Program.
 *
 * @evidence contracts/common.md#principled-implementation Separate source changes, external rule inputs and full invalidation express different Program state transitions; omitted lists denote no changes in that category.
 * @evidence contracts/common.md#clear-and-simple-design One optional change record carries only cycle transitions, while compiler and plugin selection remain fixed startup inputs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The request reports real input categories rather than forcing a test-specific reload or hiding a topology change as unchanged state.
 * @evidence contracts/common.md#meaningful-documentation Native member paragraphs explain the invalidation consequence of each category and optional-state meaning, with member spacing following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Change lists carry native file paths for the sidecar's project resolution; the type does not impose URL spelling, slash normalization or a universal filesystem case policy.
 */
export interface ResidentCheckRequest {
  /**
   * Source files whose contents changed. A file the Program already holds as a
   * source updates incrementally; any other path (a config edit, a new or
   * removed file) makes the sidecar reload the Program instead.
   */
  changed?: readonly string[];

  /**
   * Changed files that are declared inputs of a project rule (for example a
   * document an `@ttsc/evidence` graph reads). They invalidate that rule's
   * state without reloading the TypeScript Program, unless the same path is
   * also a source file.
   */
  external?: readonly string[];

  /**
   * Drop the warm Program before this cycle. Sent for a change the launcher
   * cannot localize, so the request that carries it rebuilds from scratch.
   */
  invalidate?: boolean;
}
