import type { EvidenceBenchmarkArm } from "../typings/EvidenceBenchmarkArm";
import type { ITtscEvidenceBenchmarkWorkspaceArtifact } from "./ITtscEvidenceBenchmarkWorkspaceArtifact";
import type { ITtscEvidenceBenchmarkWorkspaceVariables } from "./ITtscEvidenceBenchmarkWorkspaceVariables";

/**
 * Frozen inputs used to materialize one benchmark workspace.
 *
 * The request selects opaque requirements and one arm overlay while keeping
 * neutral template variables identical across a comparable pair.
 */
export interface ITtscEvidenceBenchmarkWorkspaceRequest {
  /** Benchmark repository containing templates and requirements. */
  repository: string;

  /** Final ignored run directory. */
  output: string;

  /** Selected opaque requirements directory name. */
  project: string;

  /** Selected Evidence or Plain treatment. */
  arm: EvidenceBenchmarkArm;

  /** Neutral template substitutions shared by both arms. */
  variables: ITtscEvidenceBenchmarkWorkspaceVariables;

  /** Evidence package archive, required only by the Evidence arm. */
  artifact?: ITtscEvidenceBenchmarkWorkspaceArtifact;

  /**
   * Locally packed workspace toolchain archives, installed into both arms.
   *
   * This repository builds the compiler the measured workspace runs, so a
   * launch packs `ttsc`, `@ttsc/lint`, `@ttsc/unplugin`, and the platform
   * package `ttsc` loads its native binary from, and passes them here. Both
   * arms receive the identical set: the toolchain is the tree under test, not
   * an arm treatment, and an arm that resolved it from the registry would
   * measure a published release instead.
   *
   * Required rather than optional, and required even though an empty array
   * still means "resolve from the registry". Every name left out of it falls
   * back to the workspace catalog, which is the right answer only where this
   * repository is not the one that publishes them — and a caller that omitted
   * the field entirely would get that answer without ever deciding on it.
   */
  toolchain: readonly ITtscEvidenceBenchmarkWorkspaceArtifact[];
}
