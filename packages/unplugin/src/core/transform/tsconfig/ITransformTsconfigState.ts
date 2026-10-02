import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * Every view of the project config a transform wrapper depends on, read
 * together.
 *
 * The wrapper, the membership policy, and the inherited template values must
 * all describe one state of the `extends` chain. The optional `signature`
 * hashes all of them together with the chain's source bytes, and a capture
 * compares it before and after compiling to prove the wrapper was not built
 * from one config state and paired with output from another.
 *
 * @evidence contracts/common.md#principled-implementation Effective paths, membership policy and template views travel together with the source-bound signature used by capture's before/after comparison; the type does not independently certify that observations were coherent.
 * @evidence contracts/common.md#clear-and-simple-design The container collects exactly the configuration views needed for wrapper construction and validation, without owning another reader or cache.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source-chain identity remains available to expose mixed configuration and output state instead of blessing a wrapper merely because its path exists.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the capture comparison, and field comments distinguish effective paths, compiler/file templates and the optional signature boundary.
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
   * Hash of every view plus the chain's source bytes; absent when no wrapper is
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
