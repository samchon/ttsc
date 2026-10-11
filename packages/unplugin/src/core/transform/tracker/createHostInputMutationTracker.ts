import path from "node:path";
import { pluginSourceCovers } from "ttsc/plugin-source";

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
 *
 * Linked components, symlink or hard-linked files and uncertain identities keep
 * metadata validation. Too many unrelated watch roots disable notification
 * authority rather than dropping inputs from validation.
 *
 * Path parsing follows the supplied filesystem's platform. An unknown case
 * policy keeps input metadata validation; a foreign view supplies its own watch
 * capability rather than opening a host-native handle for foreign paths.
 * Unmatched native event spellings withdraw notification authority; metadata
 * establishes the resulting change verdict. Each named event also rechecks its
 * identity against a fresh native view. A changed alias or case policy
 * withdraws authority instead of reusing the generation's earlier identity
 * observation for a new target.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Compiler observation scopes govern admitted events; physical identity and
 *   link checks govern whether notification silence may replace metadata reads.
 *   Uncertain name equivalence sets unverified without inventing membership change.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One constructor builds coverage, scoped classification and owned locations;
 *   both local listeners and broker sinks use the same classifier and lifecycle.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The sixteen-root limit withdraws authority rather than ignoring dependencies;
 *   links and unknown attribution fall back to actual validation, not patched paths.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish event scope from coverage authority and explain
 *   fallback boundaries; local comments give identity reasons under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral coverage uses one filesystem identity context, native realpaths,
 *   explicit view path grammar, supplied case capability and watched-directory
 *   identities; lexical aliases and junctions
 *   cannot certify quiet old physical targets as current inputs.
 *   Unicode spelling and native alternate names cannot be excluded merely by
 *   comparing event code units with the indexed names.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Sets and directory maps index inputs, scopes and ancestors; shared ancestry
 *   walks avoid rescanning common components. Event classification follows its
 *   ancestor chain plus relevant scoped roots instead of reopening the graph.
 *   Name uncertainty scans event text and uses indexed location flags; withdrawn
 *   authority incurs the owning validators' current native metadata work.
 *   Each named event has a call-local identity transaction for its path and
 *   directory; native resolution and directory-case observation are repeated
 *   because earlier event identities do not establish current equivalence.
 *   Native resolution, string keys and admission predicates retain their path
 *   costs, while recursive backend population follows admitted directories.
 *   Construction arrays and indexes grow with input paths, distinct ancestors
 *   and grouped locations. Fresh event maps and native case-probe listings are
 *   temporary; the generation memo separately retains queried historical paths.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   One construction shares physical identities, link-component checks and
 *   grouped locations; native subscriptions and scope-aware drains share only
 *   valid current owners, while every delivery rechecks watched identities.
 *   Named events revalidate the generation memo before using it. A changed
 *   physical key or directory case policy withdraws notification proof rather
 *   than silently moving earlier event witnesses to a new native target.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   A generation owns input indexes and admitted native locations, with at most
 *   sixteen unrelated roots and an eight-path mutation sample. Close withdraws
 *   authority and retires owned handles; failed construction remains untrusted
 *   and its caller must retire any handles already acquired.
 *   A recursive root can own many backend directory watches; sixteen roots is
 *   not a bound on those handles or retained path bytes. Indexes remain reachable
 *   with the tracker until its generation releases the object.
 *   The retained identity context also grows with distinct event paths and
 *   ancestors queried during this generation; it has no internal eviction or
 *   independent historical-path bound.
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
  const paths =
    (filesystem.platform ?? process.platform) === "win32"
      ? path.win32
      : path.posix;
  const identities = createHostPathIdentityContext(filesystem);
  // The project root in both of its spellings: an input the compiler reported
  // physically is the project's as much as one spelled as the project was
  // named, and the root's observer is opened once, under the name.
  const internal: TtscProjectSpellings | undefined =
    preferredRoot === undefined
      ? undefined
      : {
          physical: identities.resolve(paths.resolve(preferredRoot)).path,
          spelling: paths.resolve(preferredRoot),
        };
  const internalRoot = internal?.spelling;
  const linkedAncestors = new Map<string, boolean>();
  const authoritative = new Set(
    [...covered]
      .map((input) => paths.resolve(input))
      .filter((input) => {
        // An unmeasured directory policy cannot certify equivalence between
        // reported event spellings and inputs. Preserve metadata validation.
        if (identities.caseSensitive(paths.dirname(input)) === undefined) {
          return false;
        }
        // A link between the input and the directory watched for it, whose
        // observer follows it: the project root for an input inside the
        // project, the input's own nearest existing directory outside it. The
        // watched directory and its ancestors are re-checked by identity on
        // every delivery instead (`verifyLocations`), so a link there
        // withdraws the tracker rather than moving the input silently. Native
        // temporary roots and linked workspaces can have aliases above them.
        const watched =
          internal !== undefined &&
          relativeToProject(input, internal, filesystem.platform) !== undefined
            ? internalRoot
            : filesystem.exists(input)
              ? paths.dirname(input)
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
        } catch (error) {
          let missing = false;
          try {
            const code = (error as NodeJS.ErrnoException | undefined)?.code;
            missing = code === "ENOENT" || code === "ENOTDIR";
          } catch {}
          if (!missing) return false;
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
      let child = paths.resolve(file), parent = paths.dirname(child);
      parent !== child && !walkedAncestors.has(parent);
      child = parent, parent = paths.dirname(child)
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

      /** A requested Unicode spelling may have an ASCII native event alias. */
      uncertainNames?: true;
    }
  >();
  // The directories below `internalRoot` its recursive observer must hear, for
  // a backend that watches directory by directory (samchon/ttsc#1389): every
  // directory leading to a tracked path, a `children` path itself, and all of
  // a `subtree` path. Nothing else under the root can change an answer.
  const internalDirectories = new Set<string>();
  const internalSubtrees: string[] = [];
  // Every plugin source directory, inside the root or not, whose directories a
  // directory-level backend watches but for those the plugin build passes over
  // (samchon/ttsc#1487).
  const trees: string[] = [];
  const admitInternal = (
    probed: string,
    scope: TtscTrackedInputScope,
  ): void => {
    for (
      let directory = paths.dirname(probed);
      internal !== undefined &&
      (relativeToProject(directory, internal, filesystem.platform) ?? "") !==
        "";
      directory = paths.dirname(directory)
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
    } else if (scope === "tree") {
      trees.push(probed);
    }
  };
  const watchDirectory = (
    directory: string,
    name: string | undefined,
    recursive: boolean,
    uncertainNames: boolean = false,
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
    if (recursive) location.recursive = true;
    if (
      uncertainNames ||
      /[^\x00-\x7f]/.test(directory) ||
      (name !== undefined && /[^\x00-\x7f]/.test(name))
    ) {
      location.uncertainNames = true;
    }
    if (name === undefined) {
      // Some input needs every entry of this directory reported.
      delete location.names;
    } else {
      location.names?.add(
        normalizeHostInputName(
          name,
          identities.caseSensitive(directoryIdentity.path) !== false,
        ),
      );
    }
  };
  for (const input of inputs) {
    const absolute = paths.resolve(input);
    const exists = filesystem.exists(absolute);
    const probe = exists
      ? { directory: paths.dirname(absolute), name: paths.basename(absolute) }
      : missingPathProbe(absolute, filesystem);
    const probed = paths.resolve(probe.directory, probe.name);
    const scope = exists
      ? (scopes?.get(absolute) ??
        trackedInputScope(absolute, undefined, filesystem))
      : "subtree";
    track(probed, scope);
    if (
      internal !== undefined &&
      internalRoot !== undefined &&
      relativeToProject(absolute, internal, filesystem.platform) !== undefined
    ) {
      watchDirectory(
        internalRoot,
        undefined,
        true,
        /[^\x00-\x7f]/.test(probed),
      );
      admitInternal(probed, scope);
      continue;
    }
    // A plugin's source outside the project is watched as a whole subtree of
    // its own, since any file below it can move its state; its parent would
    // report only the directory's own entry.
    if (scope === "tree") {
      watchDirectory(probed, undefined, true);
      trees.push(probed);
      continue;
    }
    if (scope === "subtree" && exists) {
      // Unknown observations can depend on children outside the project too.
      // A parent-only subscription cannot certify this subtree. A non-directory
      // or inaccessible root fails acquisition and withdraws notification proof.
      watchDirectory(probed, undefined, true);
      internalSubtrees.push(probed);
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
    const changed = paths.resolve(directory, filename);
    const current = createHostPathIdentityContext(filesystem);
    const key = pathIdentityKey(changed, identities);
    if (
      key !== pathIdentityKey(changed, current) ||
      pathIdentityKey(directory, identities) !==
        pathIdentityKey(directory, current) ||
      identities.caseSensitive(directory) !== current.caseSensitive(directory)
    ) {
      // The memo retains the generation's and earlier events' identities for
      // overlap checks. A later alias cannot reuse those observations, and
      // refreshing them would reinterpret the already recorded witnesses.
      tracker.unverified = true;
      return undefined;
    }
    const location = locationsByDirectory.get(
      pathIdentityKey(directory, identities),
    );
    if (
      (/[^\x00-\x7f]/.test(filename) || location?.uncertainNames === true) &&
      location?.names?.has(
        normalizeHostInputName(
          filename,
          identities.caseSensitive(directory) !== false,
        ),
      ) !== true
    ) {
      // A different Unicode spelling, or an ASCII alias of a Unicode input,
      // needs native metadata. It does not establish a membership mutation.
      tracker.unverified = true;
      return undefined;
    }
    const verdict = rename ? "mutation" : "change";
    const own = tracked.get(key);
    if (own !== undefined) {
      // Only a read or an unknown subtree hears its own content change.
      if (
        rename ||
        own.has("content") ||
        own.has("subtree") ||
        own.has("tree")
      ) {
        return verdict;
      }
      return undefined;
    }
    // Moving or replacing an ancestor moves the input without an event on it.
    if (rename && ancestors.has(key)) return "mutation";
    for (
      let child = changed, parent = paths.dirname(child);
      parent !== child;
      child = parent, parent = paths.dirname(child)
    ) {
      const scopes = tracked.get(pathIdentityKey(parent, identities));
      if (scopes === undefined) continue;
      if (scopes.has("subtree")) return verdict;
      if (
        scopes.has("tree") &&
        pluginSourceCovers(parent, changed, "entry", filesystem.platform)
      ) {
        return verdict;
      }
      if (scopes.has("children") && child === changed && rename) {
        return "mutation";
      }
    }
    // A missing native alias cannot be recovered by current realpath. Neither
    // ASCII spelling nor OS name proves this event unrelated to a tracked path.
    // Keep exact metadata validation without inventing a membership mutation.
    tracker.unverified = true;
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
                : paths.join(location.directory, filename);
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
            ) ||
            trees.some(
              (tree) =>
                identities.isWithin(tree, directory) &&
                pluginSourceCovers(
                  tree,
                  directory,
                  "directory",
                  filesystem.platform,
                ),
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
