import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * Every view of the project config a transform wrapper depends on, read
 * together.
 *
 * The wrapper, the membership policy, and the inherited template values must
 * all describe one state of the `extends` chain. The optional `signature`
 * hashes all of them together with the chain's decoded source text. Capture
 * compares the observations before and after compiling to reject a changed
 * wrapper-dependent view; this container does not supply an atomic filesystem
 * snapshot or certify changes that return to the same observed state.
 *
 * @evidence contracts/common.md#principled-implementation Effective paths, membership policy and template views travel together with the source-bound signature used by capture's before/after comparison; the type does not independently certify that observations were coherent.
 * @evidence contracts/common.md#clear-and-simple-design The container collects exactly the configuration views needed for wrapper construction and validation, without owning another reader or cache.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source-chain identity remains available to expose mixed configuration and output state instead of blessing a wrapper merely because its path exists.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the capture comparison, and field comments distinguish effective paths, compiler/file templates and the optional signature boundary.
 * @evidence contracts/portability.md#os-neutral-implementation Native declaring anchors, compiler-pattern target spelling and final-consumer template anchors are distinct data carried by these views. Readers and wrapper normalization establish their resolution premises; the signature is an opaque digest, not file identity.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ITransformTsconfigState only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ITransformTsconfigState only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ITransformTsconfigState only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface ITransformTsconfigState {
  /**
   * The chain's effective `paths`, absolutized, which an alias overlay must
   * re-state.
   */
  effectivePaths: Record<string, string[]>;

  /** What the configuration admits into the program. */
  membershipPolicy: ITtscProjectMembershipPolicy;

  /**
   * Hash of every view plus decoded chain source text; absent when no wrapper is
   * materialized.
   */
  signature?: string;

  /** Inherited `${configDir}` compiler options, made absolute for the wrapper. */
  templateCompilerOptions: Record<string, unknown>;

  /**
   * Inherited `${configDir}` `files`/`include`/`exclude`, made absolute for the
   * wrapper.
   */
  templateFileSpecs: Record<string, unknown>;
}
