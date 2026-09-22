import type { TtscProjectDirectorySnapshot } from "../transform/project/TtscProjectDirectorySnapshot";
import { projectMembershipDigest } from "../transform/project/projectMembershipDigest";
import type { ITtscProjectMembershipPolicy } from "../tsconfig/ITtscProjectMembershipPolicy";

/**
 * The membership digest a project record carries (`TtscProjectRecord`): the
 * project's membership digest under the policy as the record stores it.
 *
 * A record travels as JSON, which drops a member the adapter left undefined,
 * and a refresh digests the policy it read back. Digesting the policy as it
 * would be read back, in the writer as in the reader, is what keeps the two
 * digests equal while the membership holds still; the digest under the live
 * policy could differ by exactly those members and rewrite the record on every
 * start.
 */
export function membershipRecordDigest(
  policy: ITtscProjectMembershipPolicy,
  directories: readonly TtscProjectDirectorySnapshot[],
): string {
  return projectMembershipDigest(
    JSON.parse(JSON.stringify(policy)) as ITtscProjectMembershipPolicy,
    directories,
  );
}
