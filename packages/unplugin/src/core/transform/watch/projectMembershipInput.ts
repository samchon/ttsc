import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { projectMembershipDigest } from "../project/projectMembershipDigest";
import type { TtscWatchInput } from "./TtscWatchInput";

/** One membership input per generation, shared by every module it serves. */
const PROJECT_MEMBERSHIP_INPUTS = new WeakMap<
  TtscCachedProjectTransform,
  { directories: unknown; input: TtscWatchInput }
>();

/**
 * The watch input for a generation's root-file membership, or `undefined` for a
 * generation that recorded no project walk (samchon/ttsc#1419).
 *
 * The compiler reports what it observed while building the program, and the
 * `include` expansion that decides the root files is not among it: the adapter
 * decides membership itself, through the project walk. So a file the tsconfig
 * includes, such as a new global declaration, changed no watch input a host
 * had, and a watching host never re-ran the modules whose generated code it
 * changes. This input carries that membership to the host: its path is the
 * project root, and its evidence is the walk's digest, every directory the walk
 * entered, and the policy it applied.
 *
 * Built once per recorded directory list, so every module of a generation hands
 * the host the same object.
 *
 * @evidence contracts/common.md#principled-implementation The root path carries the adapter's actual membership digest, directory population and walk policy, expressing root-file selection rather than equating it with one compiler input hash.
 * @evidence contracts/common.md#clear-and-simple-design One optional carrier represents a recorded project walk, with a memo keyed by generation and the recorded directory-list reference.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A generation without a recorded walk returns undefined rather than inventing a default membership result from its root name.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain membership ownership, absent walks and reference reuse, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Root identity comes from the generation's native context and directory spellings retain the walk's observed policy rather than relying on an OS-wide case model.
 * @evidence contracts/performance.md#efficient-algorithms First construction hashes the recorded membership and maps O(D) directory paths; a matching recorded list returns the existing carrier without another walk.
 * @evidence contracts/performance.md#reuse-equivalent-work The weak memo shares by generation and directory-array identity, assuming its membership policy and recorded directory entries remain immutable; a replacement list rebuilds the carrier.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One O(D) carrier is retained per live generation through a WeakMap and replaced on a new directory list; no native watcher or descriptor is acquired.
 */
export function projectMembershipInput(
  cached: TtscCachedProjectTransform,
): TtscWatchInput | undefined {
  const directories = cached.projectDirectories;
  if (directories === undefined) return undefined;
  const memo = PROJECT_MEMBERSHIP_INPUTS.get(cached);
  if (memo !== undefined && memo.directories === directories) {
    return memo.input;
  }
  const input: TtscWatchInput = {
    evidence: {
      identity: pathIdentityKey(
        cached.projectRoot,
        envelopeDerivation(cached).identityContext,
      ),
      missing: false,
      state: {
        codec: "membership",
        digest: projectMembershipDigest(cached.membershipPolicy, directories),
        directories: directories.map((directory) => directory.path),
        policy: cached.membershipPolicy,
      },
    },
    file: cached.projectRoot,
  };
  PROJECT_MEMBERSHIP_INPUTS.set(cached, { directories, input });
  return input;
}
