import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIsWithin } from "../filesystem/pathIsWithin";
import type { TtscProjectDirectorySnapshot } from "../project/TtscProjectDirectorySnapshot";
import { isPossibleProgramFileName } from "../project/isPossibleProgramFileName";
import { reportsProgramMembership } from "../project/reportsProgramMembership";
import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";
import { closeDirectoryWatches } from "./closeDirectoryWatches";
import { openDirectoryWatch } from "./openDirectoryWatch";
import { pathTraversesSymbolicLink } from "./pathTraversesSymbolicLink";
import { recordProjectChange } from "./recordProjectChange";
import { recordProjectMutation } from "./recordProjectMutation";
import { registerWindowsProjectMutationTracker } from "./windows/registerWindowsProjectMutationTracker";

/** Watch every walked directory for membership changes after generation. */
export async function createProjectMutationTracker(
  directories: readonly TtscProjectDirectorySnapshot[],
  covered: ReadonlySet<string>,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy: ITtscProjectMembershipPolicy = PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
): Promise<TtscProjectMutationTracker> {
  const identities = createHostPathIdentityContext(filesystem);
  const root = commonDirectoryRoot(
    directories.map((directory) => directory.path),
  );
  const authoritative =
    root !== undefined &&
    filesystem.watch === undefined &&
    pathTraversesSymbolicLink(
      path.join(root, ".ttsc-notification-authority"),
      filesystem,
      new Map(),
    )
      ? new Set<string>()
      : covered;
  const tracker: TtscProjectMutationTracker = {
    changes: new Set(),
    changesOmitted: false,
    close: () => {
      tracker.failed = true;
    },
    covered: authoritative,
    failed: false,
    membershipChanged: false,
    overlaps: (input, changed) =>
      identities.isWithin(input, changed) ||
      identities.isWithin(changed, input),
    contentAuthoritative: filesystem.watch === undefined,
  };
  if (root === undefined) return tracker;
  const knownDirectories = new Set(
    directories
      .filter((directory) => directory.relevant)
      .map((directory) => path.resolve(directory.path)),
  );
  const reportsMembership = (location: string, filename: string): boolean => {
    const changed = path.join(location, filename);
    return (
      knownDirectories.has(path.resolve(changed)) ||
      reportsProgramMembership(
        root,
        changed,
        path.basename(filename),
        policy,
        filesystem,
      )
    );
  };
  const reportsNewMembership = (
    location: string,
    filename: string,
  ): boolean => {
    const changed = path.resolve(location, filename);
    return (
      !knownDirectories.has(changed) && tracker.covered?.has(changed) !== true
    );
  };
  if (process.platform === "win32" && filesystem.watch === undefined) {
    await registerWindowsProjectMutationTracker(
      tracker,
      [{ directory: root, recursive: true }],
      false,
      filesystem,
      reportsMembership,
      (_location, filename) =>
        isPossibleProgramFileName(path.basename(filename), policy),
      reportsNewMembership,
    );
    return tracker;
  }
  const watchers: { close: () => void }[] = [];
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
          const changed = filename === null ? root : path.join(root, filename);
          const membership =
            filename === null || reportsMembership(root, filename);
          if (
            membership &&
            (eventType === "rename" ||
              reportsNewMembership(root, filename ?? ""))
          ) {
            recordProjectMutation(tracker, changed);
          } else if (
            filename === null ||
            isPossibleProgramFileName(path.basename(filename), policy)
          ) {
            recordProjectChange(tracker, changed);
          }
        },
        () => {
          tracker.failed = true;
        },
        true,
      ),
    );
  } catch {
    tracker.failed = true;
  }
  return tracker;
}

/** Common ancestor owned by every project directory snapshot. */
function commonDirectoryRoot(
  directories: readonly string[],
): string | undefined {
  if (directories.length === 0) return undefined;
  let root = path.resolve(directories[0]!);
  for (const directory of directories.slice(1)) {
    const absolute = path.resolve(directory);
    while (!pathIsWithin(absolute, root)) {
      const parent = path.dirname(root);
      if (parent === root) return root;
      root = parent;
    }
  }
  return root;
}
