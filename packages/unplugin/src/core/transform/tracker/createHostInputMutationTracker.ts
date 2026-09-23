import path from "node:path";

import type { TtscProjectSpellings } from "../filesystem/TtscProjectSpellings";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { normalizeHostInputName } from "../filesystem/normalizeHostInputName";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { relativeToProject } from "../filesystem/relativeToProject";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { missingPathProbe } from "../inputs/missingPathProbe";
import type { TtscProjectMutationTracker } from "./TtscProjectMutationTracker";
import type { TtscTrackedInputScope } from "./TtscTrackedInputScope";
import { registerBrokeredMutationTracker } from "./broker/registerBrokeredMutationTracker";
import { usesWatchBroker } from "./broker/usesWatchBroker";
import { closeDirectoryWatches } from "./closeDirectoryWatches";
import { openDirectoryWatch } from "./openDirectoryWatch";
import { pathTraversesSymbolicLink } from "./pathTraversesSymbolicLink";
import { recordProjectChange } from "./recordProjectChange";
import { recordProjectMutation } from "./recordProjectMutation";
import { settleOpenedDirectoryWatches } from "./settleOpenedDirectoryWatches";
import { trackedInputScope } from "./trackedInputScope";
import { watchLocationIdentity } from "./watchLocationIdentity";

/** Maximum unrelated roots watched before snapshot validation takes over. */
const MAX_HOST_INPUT_WATCH_SCOPES = 16;

/**
 * Watch exact universal inputs, or their nearest existing parent if missing,
 * and record only the events that can change what the compiler observed about
 * them (samchon/ttsc#1384).
 *
 * Relevance comes from each input's {@link TtscTrackedInputScope}: an event on
 * the path itself, a rename of an ancestor, and below the path only what its
 * scope admits. A directory the resolver merely probed for existence, such as
 * `node_modules`, therefore no longer collects every write beneath it, and a
 * replaced ancestor directory, which reports only itself, is no longer missed.
 */
export async function createHostInputMutationTracker(
  inputs: readonly string[],
  filesystem: TtscTransformFilesystemOperations,
  covered: ReadonlySet<string>,
  events: "all" | "rename" = "all",
  preferredRoot?: string,
  /**
   * The event scope of each input, keyed by its resolved spelling, derived from
   * the compiler's observations. An input missing here is classified from the
   * filesystem.
   */
  scopes?: ReadonlyMap<string, TtscTrackedInputScope>,
): Promise<TtscProjectMutationTracker> {
  const identities = createHostPathIdentityContext(filesystem);
  // The project root in both of its spellings: an input the compiler reported
  // physically is the project's as much as one spelled as the project was
  // named, and the root's observer is opened once, under the name.
  const internal: TtscProjectSpellings | undefined =
    preferredRoot === undefined
      ? undefined
      : {
          physical: identities.resolve(path.resolve(preferredRoot)).path,
          spelling: path.resolve(preferredRoot),
        };
  const internalRoot = internal?.spelling;
  const linkedAncestors = new Map<string, boolean>();
  const authoritative = new Set(
    [...covered]
      .map((input) => path.resolve(input))
      .filter((input) => {
        // A link between the input and the directory watched for it, whose
        // observer follows it: the project root for an input inside the
        // project, the input's own nearest existing directory outside it. The
        // watched directory and its ancestors are re-checked by identity on
        // every delivery instead (`verifyLocations`), so a link there
        // withdraws the tracker rather than moving the input silently; every
        // macOS temporary directory and any linked workspace lies below one.
        const watched =
          internal !== undefined &&
          relativeToProject(input, internal) !== undefined
            ? internalRoot
            : filesystem.exists(input)
              ? path.dirname(input)
              : missingPathProbe(input, filesystem).directory;
        if (
          pathTraversesSymbolicLink(input, filesystem, linkedAncestors, watched)
        ) {
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
  // Every tracked path with its event scope. A missing input is tracked as its
  // first missing component, whose creation can arrive through any descendant.
  const tracked = new Map<string, Set<TtscTrackedInputScope>>();
  // Every ancestor of a tracked path, whose rename moves the path with it.
  const ancestors = new Set<string>();
  const walkedAncestors = new Set<string>();
  const track = (file: string, scope: TtscTrackedInputScope): void => {
    const key = pathIdentityKey(file, identities);
    // A path observed two ways keeps every answer either observation needs.
    const current = tracked.get(key) ?? new Set<TtscTrackedInputScope>();
    current.add(scope);
    tracked.set(key, current);
    for (
      let child = path.resolve(file), parent = path.dirname(child);
      parent !== child && !walkedAncestors.has(parent);
      child = parent, parent = path.dirname(child)
    ) {
      // Every ancestor above one already walked is already recorded.
      walkedAncestors.add(parent);
      ancestors.add(pathIdentityKey(parent, identities));
    }
  };
  const locationsByDirectory = new Map<
    string,
    {
      directory: string;
      /** Entry names the watch reports, or every entry when absent. */
      names?: Set<string>;
      recursive?: boolean;
    }
  >();
  // The directories below `internalRoot` its recursive observer must hear, for
  // a backend that watches directory by directory (samchon/ttsc#1389): every
  // directory leading to a tracked path, a `children` path itself, and all of
  // a `subtree` path. Nothing else under the root can change an answer.
  const internalDirectories = new Set<string>();
  const internalSubtrees: string[] = [];
  const admitInternal = (
    probed: string,
    scope: TtscTrackedInputScope,
  ): void => {
    for (
      let directory = path.dirname(probed);
      internal !== undefined &&
      (relativeToProject(directory, internal) ?? "") !== "";
      directory = path.dirname(directory)
    ) {
      const key = pathIdentityKey(directory, identities);
      // Every directory above one already admitted is admitted as well.
      if (internalDirectories.has(key)) break;
      internalDirectories.add(key);
    }
    if (scope === "children") {
      internalDirectories.add(pathIdentityKey(probed, identities));
    } else if (scope === "subtree") {
      internalSubtrees.push(probed);
    }
  };
  const watchDirectory = (
    directory: string,
    name: string | undefined,
    recursive: boolean,
  ): void => {
    const directoryIdentity = identities.resolve(directory);
    let location = locationsByDirectory.get(directoryIdentity.key);
    if (location === undefined) {
      location = {
        directory: directoryIdentity.path,
        ...(name === undefined ? {} : { names: new Set<string>() }),
        ...(recursive ? { recursive: true } : {}),
      };
      locationsByDirectory.set(directoryIdentity.key, location);
    }
    if (name === undefined) {
      // Some input needs every entry of this directory reported.
      delete location.names;
    } else {
      location.names?.add(
        normalizeHostInputName(
          name,
          identities.caseSensitive(directoryIdentity.path),
        ),
      );
    }
  };
  for (const input of inputs) {
    const absolute = path.resolve(input);
    const exists = filesystem.exists(absolute);
    const probe = exists
      ? { directory: path.dirname(absolute), name: path.basename(absolute) }
      : missingPathProbe(absolute, filesystem);
    const probed = path.resolve(probe.directory, probe.name);
    const scope = exists
      ? (scopes?.get(absolute) ??
        trackedInputScope(absolute, undefined, filesystem))
      : "subtree";
    track(probed, scope);
    if (
      internal !== undefined &&
      internalRoot !== undefined &&
      relativeToProject(absolute, internal) !== undefined
    ) {
      watchDirectory(internalRoot, undefined, true);
      admitInternal(probed, scope);
      continue;
    }
    watchDirectory(probe.directory, probe.name, false);
    // A listing changes through the entries of the directory itself, which a
    // watch on its parent never reports.
    if (scope === "children") {
      watchDirectory(probed, undefined, false);
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
  // The identity each watch opened on; a location that no longer resolves to
  // it withdraws the tracker's authority (see `verifyLocations`).
  const opened = locations.map((location) => ({
    directory: location.directory,
    identity: watchLocationIdentity(location.directory, filesystem),
  }));
  if (opened.some((location) => location.identity === undefined)) {
    tracker.failed = true;
    return tracker;
  }
  tracker.verifyLocations = (seen) => {
    if (tracker.failed) return;
    for (const location of opened) {
      if (
        watchLocationIdentity(location.directory, filesystem, seen) !==
        location.identity
      ) {
        tracker.failed = true;
        return;
      }
    }
  };
  /**
   * The one event decision both backends share, so the in-process listener and
   * the watch broker cannot disagree about the same event (samchon/ttsc#1384).
   * A rename-only tracker drops every other event before it is classified, and
   * an event the backend could not attribute to a name may concern any input
   * below the watched directory, so it always counts.
   */
  const classify = (
    directory: string,
    filename: string | null,
    eventType: string,
  ): "change" | "mutation" | undefined => {
    // An event the backend could not attribute to a name is its notice that
    // events may have been lost below the directory, as a Windows buffer
    // overflow reports, so it counts as a mutation of any kind, before the
    // rename-only filter could drop it (samchon/ttsc#1424).
    if (filename === null) return "mutation";
    const rename = eventType === "rename";
    if (events === "rename" && !rename) return undefined;
    const changed = path.resolve(directory, filename);
    const key = pathIdentityKey(changed, identities);
    const verdict = rename ? "mutation" : "change";
    const own = tracked.get(key);
    if (own !== undefined) {
      // Only a read or an unknown subtree hears its own content change.
      if (rename || own.has("content") || own.has("subtree")) return verdict;
      return undefined;
    }
    // Moving or replacing an ancestor moves the input without an event on it.
    if (rename && ancestors.has(key)) return "mutation";
    for (
      let child = changed, parent = path.dirname(child);
      parent !== child;
      child = parent, parent = path.dirname(child)
    ) {
      const scopes = tracked.get(pathIdentityKey(parent, identities));
      if (scopes === undefined) continue;
      if (scopes.has("subtree")) return verdict;
      if (scopes.has("children") && child === changed && rename) {
        return "mutation";
      }
    }
    return undefined;
  };
  if (usesWatchBroker(filesystem)) {
    await registerBrokeredMutationTracker(
      tracker,
      locations.map((location) => ({
        directory: location.directory,
        ...(location.recursive === true
          ? { recursive: true }
          : location.names === undefined
            ? {}
            : { names: [...location.names] }),
      })),
      events === "all",
      filesystem,
      {
        filters: { classify },
        ...(preferredRoot === undefined ? {} : { probeRoot: preferredRoot }),
      },
    );
    return tracker;
  }
  const watchers: { close: () => void; ready?: Promise<boolean> }[] = [];
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
            const verdict = classify(location.directory, filename, eventType);
            const changed =
              filename === null
                ? location.directory
                : path.join(location.directory, filename);
            if (verdict === "mutation") recordProjectMutation(tracker, changed);
            else if (verdict === "change")
              recordProjectChange(tracker, changed);
          },
          () => {
            tracker.failed = true;
          },
          location.recursive === true,
          (directory) =>
            internalDirectories.has(pathIdentityKey(directory, identities)) ||
            internalSubtrees.some((subtree) =>
              identities.isWithin(subtree, directory),
            ),
        ),
      );
    } catch {
      tracker.failed = true;
    }
  }
  await settleOpenedDirectoryWatches(tracker, watchers, filesystem);
  return tracker;
}
