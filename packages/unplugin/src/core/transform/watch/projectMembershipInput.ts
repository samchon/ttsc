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
