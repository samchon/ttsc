import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { pathIsWithin } from "../filesystem/pathIsWithin";
import type { TtscProjectDirectorySnapshot } from "../project/TtscProjectDirectorySnapshot";
import { isPossibleProgramFileName } from "../project/isPossibleProgramFileName";
import { isProjectWalkDirectory } from "../project/isProjectWalkDirectory";
import { reportsProgramMembership } from "../project/reportsProgramMembership";
import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";
import { registerBrokeredMutationTracker } from "./broker/registerBrokeredMutationTracker";
import { usesWatchBroker } from "./broker/usesWatchBroker";
import { closeDirectoryWatches } from "./closeDirectoryWatches";
import { openDirectoryWatch } from "./openDirectoryWatch";
import { recordProjectChange } from "./recordProjectChange";
import { recordProjectMutation } from "./recordProjectMutation";
import { settleOpenedDirectoryWatches } from "./settleOpenedDirectoryWatches";
import { watchLocationIdentity } from "./watchLocationIdentity";

/**
 * Watch the admitted project directory tree for changes after generation.
 *
 * Membership policy distinguishes root-set changes from content writes. The
 * watched root's physical identity is verified on delivery, because an old
 * watcher can remain attached after its lexical directory is replaced.
 *
 * Directory ancestry uses the observing view's path grammar. Disjoint volumes
 * or unknown root case policy withdraw notification authority and leave the
 * recorded-state validator responsible for proof. A named event rejected by
 * lexical membership policy can still be a native alias of a program path. It
 * withdraws notification authority without asserting a structural change;
 * recorded-state validation supplies the actual verdict. Content witnesses
 * preserve captured native input aliases, then reject only an observed normal
 * directory excluded in both lexical and native spellings. Unknown, missing
 * and linked ancestry remains conservative. Membership rejection still
 * withdraws notification authority even when content is outside the walk.
 * Named events also
 * compare current native identity and case policy with the retained identity
 * transaction. Retargeting withdraws notification authority without changing
 * the meaning of earlier recorded event spellings.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The project walk and membership policy own structural relevance; content
 *   witnesses remain separate, and missing watched-root identity withdraws coverage.
 *   A lexical nonmatch is uncertainty rather than native alias exclusion.
 *   Changed native identity premises also withdraw notification proof while
 *   membership and content witnesses keep their independent classifications.
 *   Content exclusion requires normal directory identity and both policy
 *   spellings; captured native input aliases remain content witnesses.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One root, directory index and filter set define the tracker; broker and local
 *   paths share those decisions rather than duplicating backend-specific policies.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Unknown events conservatively invalidate membership; excluded trees follow
 *   the supplied project policy, not a test-shaped path blacklist or watcher patch.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs separate scope, membership and replacement authority;
 *   local identity comments explain the reason under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral relevance uses the view's path grammar, identity context and native
 *   directory identity rather than platform-wide case folding or alias prefixes.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Known directory keys provide expected-constant admission checks; common-root
 *   discovery follows ancestor depth and the observer visits admitted directories
 *   instead of opening one watch per program file or excluded dependency entry.
 *   Construction scans directory paths to find the root and build the index;
 *   temporary path arrays and the index grow with that population. Event filters
 *   include path text, supplied membership patterns and native metadata work.
 *   Each named event resolves its path and directory in a fresh transaction,
 *   including native ancestor and case-probe listing costs when required.
 *   Construction indexes captured input identities. An uncaptured possible
 *   content path may inspect each ancestor with two lstat calls and realpath
 *   until a proven exclusion; identity resolution and policy matching retain
 *   their native-query/pattern costs. No file bytes or extra watcher are read.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   One retained identity context and known-directory index serve event overlap;
 *   process-wide native producers share watches where their backend permits it,
 *   while root identity is refreshed for each delivery's verification memo.
 *   Named events recheck current identity before relying on the retained memo;
 *   changing its entries would reinterpret earlier witnesses, so mismatches
 *   withdraw authority instead. A quiet stream alone cannot restore that proof.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Generation-owned directory/input-identity indexes and watched coverage grow with the walk;
 *   diagnostic paths stay bounded at eight. Close marks failed before retiring
 *   all acquired local handles or the broker registration.
 *   A recursive root can own many admitted backend directory handles. The
 *   identity memo grows with distinct queried event paths and ancestors and has
 *   no historical-path eviction; its indexes survive until the generation
 *   releases the tracker. Fresh event maps and case listings are temporary.
 */
export async function createProjectMutationTracker(
  directories: readonly TtscProjectDirectorySnapshot[],
  covered: ReadonlySet<string>,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy: ITtscProjectMembershipPolicy = PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
): Promise<TtscProjectMutationTracker> {
  const paths =
    (filesystem.platform ?? process.platform) === "win32"
      ? path.win32
      : path.posix;
  const identities = createHostPathIdentityContext(filesystem);
  const root = commonDirectoryRoot(
    directories.map((directory) => directory.path),
    filesystem.platform,
  );
  const tracker: TtscProjectMutationTracker = {
    changes: new Set(),
    changesOmitted: false,
    close: () => {
      tracker.failed = true;
    },
    // A link at or above the root withdraws the tracker through the root's
    // identity check on every delivery (`verifyLocations`), so it costs no
    // coverage here; the walk's inputs are covered as the walk spells them.
    covered,
    failed: false,
    membershipChanged: false,
    overlaps: (input, changed) =>
      identities.isWithin(input, changed) ||
      identities.isWithin(changed, input),
    contentAuthoritative: filesystem.watch === undefined,
  };
  if (root === undefined || identities.caseSensitive(root) === undefined) {
    tracker.failed = true;
    return tracker;
  }
  const rootIdentity = watchLocationIdentity(root, filesystem);
  if (rootIdentity === undefined) {
    tracker.failed = true;
    return tracker;
  }
  tracker.verifyLocations = (seen) => {
    if (
      !tracker.failed &&
      watchLocationIdentity(root, filesystem, seen) !== rootIdentity
    ) {
      tracker.failed = true;
    }
  };
  const knownDirectories = new Set(
    directories
      .filter((directory) => directory.relevant)
      .map((directory) => paths.resolve(directory.path)),
  );
  const reportsMembership = (location: string, filename: string): boolean => {
    const changed = paths.join(location, filename);
    const current = createHostPathIdentityContext(filesystem);
    if (
      pathIdentityKey(changed, identities) !==
        pathIdentityKey(changed, current) ||
      pathIdentityKey(location, identities) !==
        pathIdentityKey(location, current) ||
      identities.caseSensitive(location) !== current.caseSensitive(location)
    ) {
      // Preserve the original overlap meaning of recorded witnesses. A later
      // event selecting another target cannot reuse that transaction's proof.
      tracker.unverified = true;
    }
    const membership =
      knownDirectories.has(paths.resolve(changed)) ||
      reportsProgramMembership(
        root,
        changed,
        paths.basename(filename),
        policy,
        filesystem,
      );
    // Current realpath cannot identify a deleted alias. Policy checks only
    // lexical spellings, so rejection cannot establish unchanged program state.
    if (!membership) tracker.unverified = true;
    return membership;
  };
  // Content belongs to the walk too. A recursive native backend can report
  // activity below directories the directory-level backend never opens.
  // Preserve native aliases of captured inputs before excluding any subtree.
  let inputIdentityKeys: Set<string> | undefined;
  try {
    inputIdentityKeys = new Set(
      [...covered].map((file) => pathIdentityKey(file, identities)),
    );
  } catch {
    tracker.unverified = true;
  }
  const reportsContent = (location: string, filename: string): boolean => {
    if (!isPossibleProgramFileName(paths.basename(filename), policy)) return false;
    const changed = paths.resolve(location, filename);
    if (covered.has(changed)) return true;
    if (inputIdentityKeys === undefined) return true;
    try {
      const current = createHostPathIdentityContext(filesystem);
      if (
        inputIdentityKeys.has(pathIdentityKey(changed, identities)) ||
        inputIdentityKeys.has(pathIdentityKey(changed, current))
      ) return true;
    } catch {
      tracker.unverified = true;
      return true;
    }
    const relative = paths.relative(root, paths.dirname(changed));
    if (
      relative === ".." ||
      relative.startsWith(".." + paths.sep) ||
      paths.isAbsolute(relative)
    ) return true;
    let directory = root;
    for (const component of relative.split(paths.sep).filter(Boolean)) {
      directory = paths.join(directory, component);
      try {
        const before = filesystem.lstat(directory);
        if (!before.isDirectory() || before.isSymbolicLink()) return true;
        const physical = filesystem.realpath(directory);
        const after = filesystem.lstat(directory);
        if (
          !after.isDirectory() || after.isSymbolicLink() ||
          before.dev !== after.dev || before.ino !== after.ino
        ) return true;
        if (
          !isProjectWalkDirectory(directory, policy, filesystem.platform) &&
          !isProjectWalkDirectory(physical, policy, filesystem.platform)
        ) return false;
      } catch {
        // Missing/deleted ancestors and unknown native spellings remain events.
        return true;
      }
    }
    return true;
  };
  const reportsNewMembership = (
    location: string,
    filename: string,
  ): boolean => {
    const changed = paths.resolve(location, filename);
    return (
      !knownDirectories.has(changed) && tracker.covered?.has(changed) !== true
    );
  };
  if (usesWatchBroker(filesystem)) {
    await registerBrokeredMutationTracker(
      tracker,
      [{ directory: root, recursive: true }],
      false,
      filesystem,
      {
        filters: {
          changeAddsMembership: reportsNewMembership,
          content: reportsContent,
          membership: reportsMembership,
        },
        probeRoot: root,
      },
    );
    return tracker;
  }
  const watchers: { close: () => void; ready?: Promise<boolean> }[] = [];
  tracker.close = () => {
    tracker.failed = true;
    closeDirectoryWatches(watchers);
  };
  try {
    watchers.push(
      openDirectoryWatch(
        filesystem,
        root,
        (eventType, filename) => {
          // An unattributed event may stand for lost events of any kind below
          // the root, a membership change among them (samchon/ttsc#1424).
          if (filename === null) {
            recordProjectMutation(tracker, root);
            return;
          }
          const changed = paths.join(root, filename);
          const membership = reportsMembership(root, filename);
          if (
            membership &&
            (eventType === "rename" || reportsNewMembership(root, filename))
          ) {
            recordProjectMutation(tracker, changed);
          } else if (reportsContent(root, filename)) {
            recordProjectChange(tracker, changed);
          }
        },
        () => {
          tracker.failed = true;
        },
        true,
        // Only the directories the walk enters, so a Linux capture never
        // walks or watches `node_modules`.
        (directory) =>
          isProjectWalkDirectory(directory, policy, filesystem.platform),
      ),
    );
  } catch {
    tracker.failed = true;
  }
  await settleOpenedDirectoryWatches(tracker, watchers, filesystem);
  return tracker;
}

/** Common ancestor owned by every project directory snapshot. */
function commonDirectoryRoot(
  directories: readonly string[],
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const paths = platform === "win32" ? path.win32 : path.posix;
  if (directories.length === 0) return undefined;
  let root = paths.resolve(directories[0]!);
  for (const directory of directories.slice(1)) {
    const absolute = paths.resolve(directory);
    while (!pathIsWithin(absolute, root, platform)) {
      const parent = paths.dirname(root);
      if (parent === root) return undefined;
      root = parent;
    }
  }
  return root;
}
