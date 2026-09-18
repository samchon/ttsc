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
