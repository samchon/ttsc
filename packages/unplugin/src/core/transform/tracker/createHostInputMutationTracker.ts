import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { normalizeHostInputName } from "../filesystem/normalizeHostInputName";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { pathIsWithin } from "../filesystem/pathIsWithin";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { missingPathProbe } from "../inputs/missingPathProbe";
import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";
import { closeDirectoryWatches } from "./closeDirectoryWatches";
import { openDirectoryWatch } from "./openDirectoryWatch";
import { pathTraversesSymbolicLink } from "./pathTraversesSymbolicLink";
import { recordProjectChange } from "./recordProjectChange";
import { recordProjectMutation } from "./recordProjectMutation";
import { registerWindowsProjectMutationTracker } from "./windows/registerWindowsProjectMutationTracker";

/** Maximum unrelated roots watched before snapshot validation takes over. */
const MAX_HOST_INPUT_WATCH_SCOPES = 16;

/** Watch exact universal inputs, or their nearest existing parent if missing. */
export async function createHostInputMutationTracker(
  inputs: readonly string[],
  filesystem: TtscTransformFilesystemOperations,
  covered: ReadonlySet<string>,
  events: "all" | "rename" = "all",
  preferredRoot?: string,
): Promise<TtscProjectMutationTracker> {
  const identities = createHostPathIdentityContext(filesystem);
  const linkedAncestors = new Map<string, boolean>();
  const authoritative = new Set(
    [...covered]
      .map((input) => path.resolve(input))
      .filter((input) => {
        if (pathTraversesSymbolicLink(input, filesystem, linkedAncestors)) {
          return false;
        }
        try {
          // A lexical symlink can keep its own directory silent while a target
          // elsewhere changes or appears. Its joined metadata proof must stay
          // on the validation path, including while the link is broken.
          const lexical = filesystem.lstat(input);
          if (
            lexical.isSymbolicLink() ||
            (lexical.isFile() && lexical.nlink > 1n)
          )
            return false;
        } catch {
          // A genuinely absent lexical path is covered by its nearest existing
          // ancestor and remains eligible for notification proof.
        }
        const target = hostInputRealpath(input, filesystem);
        return (
          target === null ||
          pathIdentityKey(target, identities) ===
            pathIdentityKey(input, identities)
        );
      }),
  );
  const locationsByDirectory = new Map<
    string,
    {
      directory: string;
      names: Set<string>;
      paths?: Set<string>;
      recursive?: boolean;
    }
  >();
  const internalRoot =
    preferredRoot === undefined ? undefined : path.resolve(preferredRoot);
  for (const input of inputs) {
    const absolute = path.resolve(input);
    const probe = filesystem.exists(absolute)
      ? { directory: path.dirname(absolute), name: path.basename(absolute) }
      : missingPathProbe(absolute, filesystem);
    const internal =
      internalRoot !== undefined && pathIsWithin(absolute, internalRoot);
    const directory = internal ? internalRoot : probe.directory;
    const directoryIdentity = identities.resolve(directory);
    let location = locationsByDirectory.get(directoryIdentity.key);
    if (location === undefined) {
      location = {
        directory: directoryIdentity.path,
        names: new Set<string>(),
        ...(internal ? { paths: new Set<string>(), recursive: true } : {}),
      };
      locationsByDirectory.set(directoryIdentity.key, location);
    }
    if (location.paths !== undefined) {
      location.paths.add(
        pathIdentityKey(path.resolve(probe.directory, probe.name), identities),
      );
    } else {
      location.names.add(
        normalizeHostInputName(
          probe.name,
          identities.caseSensitive(directoryIdentity.path),
        ),
      );
    }
  }
  const locations = [...locationsByDirectory.values()];
  const tracker: TtscProjectMutationTracker = {
    changes: new Set(),
    changesOmitted: false,
    close: () => {
      tracker.failed = true;
    },
    // Coverage is the caller's claim, and it is required rather than derived
    // from the input list: an input is watched by its exact name here, but only
    // the caller knows whether the path leading to it is watched as well, which
    // is what a later validation needs before it trusts the watcher instead of
    // probing the path again. Deriving it here would hand that claim to every
    // future caller by default (samchon/ttsc#1261).
    covered: authoritative,
    contentAuthoritative: filesystem.watch === undefined,
    failed: false,
    membershipChanged: false,
    overlaps: (input, changed) =>
      identities.isWithin(input, changed) ||
      identities.isWithin(changed, input),
  };
  if (locations.length > MAX_HOST_INPUT_WATCH_SCOPES) {
    // A graph spread over unrelated external roots cannot be folded into one
    // recursive observer without watching an arbitrarily broad filesystem
    // ancestor. Decline the notification proof and use the recorded snapshots;
    // descriptor count must never scale with an adversarial input graph.
    tracker.failed = true;
    return tracker;
  }
  const matches = (directory: string, filename: string): boolean => {
    const location = locationsByDirectory.get(
      identities.resolve(directory).key,
    );
    if (location === undefined) return false;
    if (location.paths !== undefined) {
      let changed = path.resolve(directory, filename);
      for (;;) {
        if (location.paths.has(pathIdentityKey(changed, identities))) {
          return true;
        }
        const parent = path.dirname(changed);
        if (parent === changed || !pathIsWithin(parent, location.directory)) {
          return false;
        }
        changed = parent;
      }
    }
    return location.names.has(
      normalizeHostInputName(filename, identities.caseSensitive(directory)),
    );
  };
  if (process.platform === "win32" && filesystem.watch === undefined) {
    await registerWindowsProjectMutationTracker(
      tracker,
      locations.map((location) => ({
        directory: location.directory,
        ...(location.recursive === true
          ? { recursive: true }
          : { names: [...location.names] }),
      })),
      events === "all",
      filesystem,
      matches,
      matches,
    );
    return tracker;
  }
  const watchers: { close: () => void }[] = [];
  tracker.close = () => {
    tracker.failed = true;
    closeDirectoryWatches(watchers);
  };
  for (const location of locations) {
    try {
      watchers.push(
        openDirectoryWatch(
          filesystem,
          location.directory,
          (eventType, filename) => {
            if (events === "rename" && eventType !== "rename") {
              return;
            }
            if (filename === null || matches(location.directory, filename)) {
              const changed =
                filename === null
                  ? location.directory
                  : path.join(location.directory, filename);
              if (eventType === "rename") {
                recordProjectMutation(tracker, changed);
              } else {
                recordProjectChange(tracker, changed);
              }
            }
          },
          () => {
            tracker.failed = true;
          },
          location.recursive === true,
        ),
      );
    } catch {
      tracker.failed = true;
    }
  }
  return tracker;
}
