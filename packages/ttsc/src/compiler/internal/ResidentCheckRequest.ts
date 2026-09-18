/**
 * One watch cycle sent to a resident `check-serve` sidecar: the filesystem
 * transitions since the previous cycle, and nothing else.
 *
 * The sidecar keeps its Program warm across cycles. Each field tells it how
 * much of that Program the change can have affected; an empty request re-runs
 * the check on the unchanged Program.
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
