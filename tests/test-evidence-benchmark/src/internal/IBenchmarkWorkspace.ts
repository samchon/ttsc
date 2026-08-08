import type { ITtscEvidenceBenchmarkWorkspaceArtifact } from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkWorkspaceArtifact";
import type { EvidenceBenchmarkArm } from "../../../../benchmarks/evidence/src/typings/EvidenceBenchmarkArm";

/** A prepared benchmark workspace, standing on disk exactly as a launch left it. */
export interface IBenchmarkWorkspace {
  /** Which treatment the overlay applied. */
  readonly arm: EvidenceBenchmarkArm;

  /** Requirements directory name copied into `docs/analysis/`. */
  readonly subject: string;

  /** Run directory the preparation published with its atomic rename. */
  readonly root: string;

  /** The prepared project a measured cell would work in. */
  readonly workspace: string;

  /** Package name the template's `{{apiPackageName}}` variable resolved to. */
  readonly apiPackageName: string;

  /**
   * The packed workspace toolchain this arm was prepared with.
   *
   * Held as the artifacts the packer produced rather than as names written
   * down, so a case reads which packages a launch binds locally instead of
   * asserting against a second list that can disagree with the first. Both arms
   * carry the identical set: the compiler is the tree under test, never an arm
   * treatment.
   */
  readonly toolchain: readonly ITtscEvidenceBenchmarkWorkspaceArtifact[];

  /**
   * Returns the workspace to its baseline commit.
   *
   * Preparation commits the neutral baseline, so the baseline is a real Git
   * state rather than a bookkeeping copy this suite maintains. Restoring
   * through Git therefore reverts exactly what a cell could have changed, and
   * leaves the ignored install and build outputs alone — which is what makes
   * one prepared workspace reusable across cases without a second install.
   */
  restore(): void;
}
