import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { hashText } from "../utils/hashText";
import { stableStringify } from "../utils/stableStringify";
import type { TtscProjectDirectorySnapshot } from "./TtscProjectDirectorySnapshot";

/**
 * Digest a project's root-file membership: the policy that decides it and every
 * directory that can hold a program input, with its membership signature
 * (samchon/ttsc#1419).
 *
 * It is the same judgement `sameProjectDirectories` makes. Directories that
 * cannot hold a program input are left out, so a bundler filling its output
 * directory leaves the digest alone, while a program input appearing anywhere
 * the walk enters changes a signature and with it the digest. The policy is
 * part of it, since the same directories under another rule are another
 * membership, and a re-walk must apply the rule the digest was taken under.
 *
 * @param policy The rule the walk applied.
 * @param directories The walk's directory snapshots.
 *
 * @evidence contracts/common.md#principled-implementation Relevant directory address/signature pairs and the exact membership policy define the digest; sorting the pairs removes enumeration order without discarding policy arrays or admitted-input meaning.
 * @evidence contracts/common.md#clear-and-simple-design A projection, lexical sort and shared encoding/hash compose the identity without performing another filesystem walk.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Irrelevant emitted trees are excluded by the walk's computed relevance, not hardcoded output names; changed policy remains part of the identity.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain policy inclusion, irrelevant-directory omission and equivalence to the membership comparison; parameter tags name the contributing values.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Hashes directory signatures and the policy that were already collected; it reads no filesystem.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Temporary pairs and serialization are local to this call; the digest transfers to its caller and no resource is retained.
 * @evidence contracts/performance.md#efficient-algorithms One filtering projection retains relevant directories, then sorting costs O(r log r) for r relevant entries; hashing and serialization scale with the selected signatures and policy representation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The operation hashes caller-supplied values and coordinates no completed or in-flight computation; mutable snapshot arrays and policy do not authorize persistent memoization here.
 */
export function projectMembershipDigest(
  policy: ITtscProjectMembershipPolicy,
  directories: readonly TtscProjectDirectorySnapshot[],
): string {
  return hashText(
    stableStringify({
      directories: directories
        .filter((directory) => directory.relevant)
        .map((directory) => [directory.path, directory.signature])
        .sort((left, right) =>
          left[0]! < right[0]! ? -1 : left[0]! > right[0]! ? 1 : 0,
        ),
      policy,
    }),
  );
}
