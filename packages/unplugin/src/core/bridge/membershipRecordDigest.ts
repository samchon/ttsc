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
 *
 * @evidence contracts/common.md#principled-implementation
 *   JSON round-tripping gives the live policy its persisted representation before
 *   membership hashing, so omitted undefined members match the later reader.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns persistence normalization; projectMembershipDigest owns
 *   membership identity and directory selection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Normalization follows the record's actual JSON boundary rather than suppressing
 *   arbitrary policy differences to force a cache hit.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain writer/reader equivalence and undefined omission,
 *   with prose/tag separation following documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Digesting acquires and retains no handle, task or state.
 * @evidence contracts/performance.md#efficient-algorithms One JSON round trip of the policy and one digest over the relevant directories, linear in the policy and directory-list size; the round trip is what makes writer and reader digest the same bytes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure function of its arguments; callers digest once per generation and nothing is shared here.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Operates on a JSON value and directory snapshots already collected; it reads no filesystem and parses no path.
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
