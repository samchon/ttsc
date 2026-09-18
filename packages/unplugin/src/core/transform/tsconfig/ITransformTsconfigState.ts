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
 */
export interface ITransformTsconfigState {
  effectivePaths: Record<string, string[]>;
  membershipPolicy: ITtscProjectMembershipPolicy;
  signature?: string;
  templateCompilerOptions: Record<string, unknown>;
  templateFileSpecs: Record<string, unknown>;
}
