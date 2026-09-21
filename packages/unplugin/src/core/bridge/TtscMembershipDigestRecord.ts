import type { ITtscProjectMembershipPolicy } from "../tsconfig/ITtscProjectMembershipPolicy";

/**
 * What a membership record file holds (`membershipDigestFile`): the project a
 * refresh walks again, and the digest the host's persistent cache last saw.
 */
export interface TtscMembershipDigestRecord {
  /**
   * The walk's digest, `projectMembershipDigest`, or `null` when the tsconfig
   * is gone.
   */
  digest: string | null;
  /** The rule the walk applied, so a refresh applies the same one. */
  policy: ITtscProjectMembershipPolicy;
  /** The project root the walk starts from. */
  root: string;
  /** The tsconfig the record belongs to, as the adapter names it. */
  tsconfig: string;
}
