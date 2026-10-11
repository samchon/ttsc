import fs from "node:fs";
import path from "node:path";
import { createFilesystemPathIdentityContext } from "ttsc/path-identity";
import { pluginSourceCovers } from "ttsc/plugin-source";

import { refreshProcessClockReference } from "../transform/clock/refreshProcessClockReference";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscProjectSpellings } from "../transform/filesystem/TtscProjectSpellings";
import { pathIsWithin } from "../transform/filesystem/pathIsWithin";
import { relativeToProject } from "../transform/filesystem/relativeToProject";
import { pluginSourceHolds } from "../transform/inputs/pluginSourceHolds";
import { validateGraphInputObservation } from "../transform/inputs/validateGraphInputObservation";
import { isProjectWalkDirectory } from "../transform/project/isProjectWalkDirectory";
import { projectMembershipMatches } from "../transform/project/projectMembershipMatches";
import { watchLocationIdentity } from "../transform/tracker/watchLocationIdentity";
import { captureWatchInputBaseline } from "../transform/watch/captureWatchInputBaseline";
import { captureWatchInputBaselines } from "../transform/watch/captureWatchInputBaselines";
import { watchInputEvidenceMatchesBaseline } from "../transform/watch/watchInputEvidenceMatchesBaseline";
import type { ITtscProjectMembershipPolicy } from "../tsconfig/ITtscProjectMembershipPolicy";
import type { InputEntry } from "./InputEntry";
import type { InputObserver } from "./InputObserver";
import type { InputObserverChange } from "./InputObserverChange";
import type { InputObserverOperations } from "./InputObserverOperations";
import type { LinkedPath } from "./LinkedPath";
import type { WatchScope } from "./WatchScope";
import { containsPath } from "./containsPath";
import { hasMultipleLinks } from "./hasMultipleLinks";
import { linkedComponents } from "./linkedComponents";
import { nearestExistingDirectory } from "./nearestExistingDirectory";
import { openIsolatedRecursiveWatch } from "./openIsolatedRecursiveWatch";
import { openRecursiveWatch } from "./openRecursiveWatch";
import { openWatchPoller } from "./openWatchPoller";
import { realpath } from "./realpath";
import { someSet } from "./someSet";

/**
 * The adapter's observer of compiler inputs, keyed by owner: each owner
 * registers the inputs one delivery depended on, and hears which owners' inputs
 * changed.
 *
 * Two owners use it. The Vite dev server's owners are its importers
 * (`createViteServeInputWatch`), which it reloads or invalidates through Vite's
 * own graph; a watching build's bridge's owners are project records
 * (`openHostWatchBridge`), which it moves. Neither sees the other's shape: the
 * observer reports through `onChanged` alone (samchon/ttsc#1485).
 *
 * One recursive scope observes the project root, pinned once the observer
 * opens, and at most 16 external scopes the inputs outside it, each closed when
 * its last input leaves. Every native scope retains authority only while its
 * physical root still matches its configured spelling. A healthy external
 * scope admits newly registered descendants while its root identity and
 * physical containment still hold; the scope cap is checked only when no
 * existing scope covers them.
 * Ordinary files use events after their initial subscription is observed;
 * one shared poll verifies each occupied scope's location, not each file.
 * Missing spellings and directory predicates use the recursive observer for
 * their nearest available scope. Inputs a native scope cannot safely cover
 * share one bounded fallback poll; linked files also share topology checks
 * because retargeting a junction need not emit events on its old descendants.
 * Every event is re-checked against the input's recorded condition before an
 * owner hears it, so an event that changed nothing the compile observed is
 * silent. Native event names can have aliases missing from lexical indexes.
 * Each settled event batch therefore rechecks all registered conditions of the
 * reporting scope; directory admission still limits native watch coverage.
 *
 * Large event waves yield between bounded entry slices so native IPC and host
 * requests can advance. Each slice reads current facts with its own fresh
 * contexts; only callback results retain the registration they belong to.
 *
 * A project's root-file membership is one entry for the project root
 * (samchon/ttsc#1419). Its scope admits every directory the project walk
 * enters, and an event in its scope schedules a current policy-aware walk. Its
 * owners are reported as invalidated rather than reloaded, since most new files
 * change no other module.
 *
 * A plugin's Go source directory is one entry too (samchon/ttsc#1487). Its
 * scope admits every directory below it but those the plugin build passes over
 * (`pluginSourceCovers`), any event below it marks it, and its check proves the
 * state the plugin build keyed the binary on, its files and the environment a
 * build there runs in (`pluginSourceHolds`, samchon/ttsc#1493), trusting its
 * files' metadata only against a clock reference the check mints first
 * (`refreshProcessClockReference`). Its owners are reloaded, since the plugin's
 * output can change for every module.
 *
 * @param onChanged Told, once per settled batch of events, which owners' inputs
 *   changed: `reload` for a changed input, and `invalidate` for a membership
 *   change alone.
 * @param operations Watch/poll and identity-case capabilities. These do not
 *   replace the native filesystem used to read input conditions or paths.
 * @evidence contracts/common.md#principled-implementation
 *   Owned registration maps and callbacks separate compiler-input conditions
 *   from Vite importer or build-record policy.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One observer indexes input conditions and owners, while callback consumers
 *   decide reload versus record signaling. Shared native scopes and one poller
 *   cover capability boundaries without duplicating each owner's watcher tree.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The public filesystem identity helper and injected native watch seams
 *   provide the implementation boundary; the observer does not patch either
 *   consumer's methods.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains the two owner kinds, why membership and plugin trees
 *   need observation, and why links or uncovered scopes need polling. Separate
 *   paragraphs give purpose and reasons under the documentation skill;
 *   InputObserver documents the returned lifecycle contract.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Filesystem identity comes from ttsc/path-identity and directory
 *   capabilities rather than a universal lowercase path. Unknown case policy
 *   keeps exact identity, routes both case candidates and requires polling;
 *   an observed or supplied insensitive-directory answer folds registration
 *   aliases. Event history includes all alias key forms without claiming that
 *   their spellings identify the same filesystem object.
 *   The actual host chooses the default broker on Windows/macOS and Linux
 *   recursive backend otherwise; the injected platform selects identity grammar,
 *   not a foreign filesystem implementation. Native path reads remain native.
 *   Native failures and uncovered link topology motivate the shared polling
 *   boundary, whose behavior remains owned by the observer.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Identity maps index entries and their owners; settled events deduplicate
 *   pending entries before rechecking all reporting-scope conditions. This
 *   input-proportional validation is needed because lexical names cannot exclude
 *   native aliases; unrelated scopes are not selected. Registration also builds
 *   ancestor aliases/contributions and serializes nonmembership evidence. Native
 *   identity queries, owner/condition fanout, membership walks, predicate lists
 *   and plugin-tree proofs retain path/content/entry costs. Admission scans live
 *   membership/tree conditions; one prune per changed scope avoids repeated
 *   retirement scans. Poll slices bound selected probes, not dependent fanout,
 *   native read bytes or proof duration.
 *   Native event waves also bound entries per turn, retaining their fixed
 *   population and owner-result maps until completion or disposal. Poll scope
 *   and link fanout beyond the immediate slice joins that yielding queue.
 *   Named-event history uses at most three lexical keys per path without native
 *   namespace queries. Each replacement validates at most 17 native
 *   roots once before binding inputs; each poll and native callback validates
 *   its current locations afresh. An external registration scans the bounded scope
 *   population for exact lexical ancestors, validating their current identity
 *   and physical containment before sharing native coverage.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Owners with the same resolved lexical input and recorded condition key
 *   share one entry/condition; event aliases help route native spellings but do
 *   not merge every physical alias into one entry. Scopes and linked topology
 *   probes are shared across contributors. Recursive external coverage is
 *   shared only for exact lexical descendants still physically below a healthy
 *   observer's unchanged root; failed or replaced roots confer no coverage.
 *   Pinned roots follow the same identity rule. Same-root reattachment rebuilds
 *   failed coverage while retaining owner conditions; until then one shared
 *   fallback poll checks uncovered inputs.
 *   Changed condition keys lose their
 *   previous ownership, and rename/removal/reanchor boundaries retire stale
 *   path memos. One clock reference is minted per selected plugin-tree batch.
 *   Ordinary checks share namespace facts only within each fresh synchronous
 *   phase, never between phases or turns. Delayed reports retain registration
 *   identity, so a replaced or forgotten owner cannot receive an old effect.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Last-owner removal and dispose attempt watch/poll cleanup, suppressing close
 *   failures; a thrown backend close is not certified as released. Conditions
 *   remove their directory contributions when they leave; root or polling
 *   policy changes and lost project-root authority rebuild scopes on attachment
 *   without retaining old admission history. Failed scopes relinquish callback
 *   authority before attempting close, even when close throws. Retired poll
 *   callbacks cannot act on a later observer lifetime.
 *   Conditions and owners still require input-proportional memory, and a capped
 *   scope count does not bound the number of admitted descendant subscriptions
 *   or input/path/evidence bytes. Change history clears above 100,000 keys;
 *   unknown-case ancestor memos live until their reset boundary. Named events
 *   retain history keys without adding unrelated directories to those memos.
 *   Dispose clears registrations/timers but retains the opened root and permits
 *   later delivery to reacquire scopes. Callback/proof/poll-construction
 *   exceptions can escape; this operation provides no general rollback of
 *   effects already performed.
 */
export function createInputObserver(
  onChanged: (change: InputObserverChange) => void,
  operations: Partial<InputObserverOperations> = {},
): InputObserver {
  const entries = new Map<string, InputEntry>();
  const aliases = new Map<string, Set<InputEntry>>();
  const renameAliases = new Map<string, Set<InputEntry>>();
  const ownerInputs = new Map<string, Map<string, string>>();
  const ownerRegistrations = new Map<string, object>();
  const pending = new Set<InputEntry>();
  // Entries holding a project's root-file membership (samchon/ttsc#1419).
  const memberships = new Set<InputEntry>();
  // Entries holding a plugin's Go source directory, whose state any file
  // below it can move (samchon/ttsc#1487).
  const trees = new Set<InputEntry>();
  const polled = new Set<InputEntry>();
  const links = new Map<string, LinkedPath>();
  const scopes = new Map<string, WatchScope>();
  const scopesToPrune = new Set<WatchScope>();
  const componentLinks = new Map<string, string | null>();
  const missingComponents = new Set<string>();
  const changes = new Map<string, number>();
  // Whether the observer has opened: an owner registered before it is not
  // observed, since no root anchors its project scope yet.
  let opened = false;
  let projectRoot: string | undefined;
  // The project root in both of its spellings: the owner names it as it was
  // configured, while an input a resolver arrives at is spelled physically,
  // and the project scope hears both under the name it was opened on.
  let project: TtscProjectSpellings | undefined;
  // Whether the owner declared polling, which leaves native notifications
  // unproven on its filesystem, so every entry goes to the bounded poll
  // (samchon/ttsc#1395).
  let polling = false;
  let changeSequence = 0;
  let historyFloor = 0;
  let linkIterator: MapIterator<[string, LinkedPath]> | undefined;
  let pollIterator: SetIterator<InputEntry> | undefined;
  let poller: { close(): void } | undefined;
  let flushTimer: NodeJS.Timeout | undefined;

  // Windows uses ttsc's native completion-port helper, excluding access-only
  // notifications without opening Node fs-event handles (samchon/ttsc#1719).
  // Do not restore fs.watch here: reads can invalidate an unchanged generation,
  // and deleting a watched temporary tree can abort Node (samchon/ttsc#1411).
  // macOS keeps each scope in its own brokered FSEventStream, whose dropped
  // events are reported instead of lost (samchon/ttsc#1418, samchon/ttsc#1425).
  const open =
    operations.watch ??
    (process.platform === "win32" || process.platform === "darwin"
      ? openIsolatedRecursiveWatch
      : openRecursiveWatch);
  const openPoller = operations.poll ?? openWatchPoller;
  const platform = operations.platform ?? process.platform;
  const createCaseIdentities = () =>
    createFilesystemPathIdentityContext({
      ...(operations.caseSensitive === undefined
        ? {}
        : { caseSensitive: operations.caseSensitive }),
      platform,
      throwOnRealpathError: false,
    });
  let caseIdentities = createCaseIdentities();
  const directoryCaseSensitivity = new Map<string, boolean | undefined>();
  let pathIdentityMemosDirty = false;
  // Whether a rename has been heard since the memos were last reset. Only a
  // rename can make a remembered path fact wrong, so only a removal that
  // follows one resets them; a removal for a registration that replaced its
  // inputs keeps them, which on Windows spares one `fsutil` query per
  // directory (samchon/ttsc#1443).
  let topologyChanged = false;

  /** Drop path facts after topology or ownership changes make them stale. */
  const resetPathIdentityMemos = (): void => {
    caseIdentities = createCaseIdentities();
    directoryCaseSensitivity.clear();
    pathIdentityMemosDirty = false;
    topologyChanged = false;
  };

  /** Lexical event key under the nearest existing directory's case policy. */
  const watchPathKey = (file: string): string => {
    const absolute = path.resolve(file);
    let current = path.dirname(absolute);
    const traversed: string[] = [];
    let sensitive: boolean | undefined;
    for (;;) {
      const cacheKey = current;
      sensitive = directoryCaseSensitivity.get(cacheKey);
      if (directoryCaseSensitivity.has(cacheKey)) break;
      traversed.push(cacheKey);
      try {
        if (fs.statSync(current).isDirectory()) {
          sensitive = caseIdentities.caseSensitive(current);
          break;
        }
      } catch {
        // A missing suffix inherits the nearest existing ancestor's policy.
      }
      const parent = path.dirname(current);
      if (parent === current) {
        // An unmeasured policy remains unknown, preserving exact spelling.
        sensitive = caseIdentities.caseSensitive(current);
        break;
      }
      current = parent;
    }
    for (const directory of traversed) {
      directoryCaseSensitivity.set(directory, sensitive);
    }
    return sensitive === false ? absolute.toLowerCase() : absolute;
  };

  /** Unknown case policy broadens event candidates, never identity equality. */
  const watchEventKeys = (file: string): string[] => {
    const absolute = path.resolve(file);
    const key = watchPathKey(absolute);
    return directoryCaseSensitivity.get(path.dirname(absolute)) === undefined
      ? [key, `unknown-case\0${absolute.toLowerCase()}`]
      : [key];
  };

  /**
   * Candidate history covers every registration key without querying its case
   * policy. Extra matches only request proof; they never establish identity.
   */
  const watchChangeKeys = (absolute: string): string[] => {
    const folded = absolute.toLowerCase();
    return [absolute, folded, `unknown-case\0${folded}`];
  };

  const unbindAlias = (alias: string, entry: InputEntry): void => {
    const indexed = aliases.get(alias);
    indexed?.delete(entry);
    if (indexed?.size === 0) aliases.delete(alias);
  };

  /** The policies of an entry's membership conditions. */
  const membershipPolicies = (
    entry: InputEntry,
  ): ITtscProjectMembershipPolicy[] => {
    const policies: ITtscProjectMembershipPolicy[] = [];
    for (const condition of entry.conditions.values()) {
      const state = condition.evidence?.state;
      if (state?.codec === "membership") policies.push(state.policy);
    }
    return policies;
  };

  /**
   * A path below a membership's or a plugin source's root, under the root's own
   * name, or `undefined` when the root does not contain it. The root is matched
   * under both of its spellings: a backend that reports physical paths names a
   * root reached through a link by its target, while the policy and the walk
   * spell it as the host named it (samchon/ttsc#1461).
   */
  const namedBelow = (entry: InputEntry, file: string): string | undefined => {
    const below = relativeToProject(file, {
      physical: entry.physical ?? entry.file,
      spelling: entry.file,
    });
    return below === undefined ? undefined : path.join(entry.file, below);
  };

  /** Whether a membership in `scope` needs a directory-level watch there. */
  const admitsMembership = (scope: WatchScope, directory: string): boolean => {
    for (const entry of memberships) {
      const named = namedBelow(entry, directory);
      if (!entry.scopes.has(scope) || named === undefined) continue;
      if (
        membershipPolicies(entry).some((policy) =>
          isProjectWalkDirectory(named, policy),
        )
      ) {
        return true;
      }
    }
    return false;
  };

  /**
   * Whether a plugin source in `scope` needs a directory-level watch there:
   * every directory below it but those the plugin build passes over.
   */
  const admitsTree = (scope: WatchScope, directory: string): boolean => {
    for (const entry of trees) {
      const named = namedBelow(entry, directory);
      if (!entry.scopes.has(scope) || named === undefined) continue;
      if (pluginSourceCovers(entry.file, named, "directory")) return true;
    }
    return false;
  };

  const closeScope = (scope: WatchScope): void => {
    // The root's case policy may have changed with its physical location.
    // Retire by owned scope identity rather than recomputing its old map key.
    for (const [key, candidate] of scopes)
      if (candidate === scope) scopes.delete(key);
    const watcher = scope.watcher;
    scope.watcher = undefined;
    try {
      watcher?.close();
    } catch {
      // The generation no longer trusts this scope, so cleanup is best effort.
    }
    scopesToPrune.delete(scope);
  };

  /** Reconcile widened tree admission after a condition loses its last owner. */
  const refreshConditionCoverage = (entry: InputEntry): void => {
    let membership = false;
    let tree = false;
    for (const condition of entry.conditions.values()) {
      membership ||= condition.evidence?.state?.codec === "membership";
      tree ||= condition.evidence?.state?.codec === "tree";
      if (membership && tree) break;
    }
    if (!membership) memberships.delete(entry);
    if (!tree) trees.delete(entry);
    for (const scope of entry.scopes) scopesToPrune.add(scope);
  };

  const recordChange = (eventType: string, file: string): void => {
    const absolute = path.resolve(file);
    const parent = path.dirname(absolute);
    const direct = new Set<string>();
    const parents = new Set<string>();
    if (eventType === "rename") {
      // Keep the active identity context until affected entries are removed.
      // Their alias and scope indexes were built with that context; changing
      // only the resolver here could make later events unable to reach them.
      // `check()` resets the memos atomically if this topology change removes
      // an entry, while unrelated renames leave still-valid indexes intact.
      componentLinks.clear();
      missingComponents.clear();
      topologyChanged = true;
    }
    changeSequence += 1;
    for (const key of watchChangeKeys(absolute)) direct.add(key);
    for (const key of watchChangeKeys(parent)) parents.add(key);
    for (const key of direct) {
      componentLinks.delete(key);
      missingComponents.delete(key);
      changes.set(key, changeSequence);
    }
    for (const key of parents) changes.set(key, changeSequence);
    if (changes.size > MAX_CHANGE_HISTORY) {
      changes.clear();
      historyFloor = changeSequence;
    }
  };

  const remove = (entry: InputEntry): void => {
    entries.delete(entry.file);
    pending.delete(entry);
    memberships.delete(entry);
    trees.delete(entry);
    polled.delete(entry);
    for (const alias of entry.aliases) unbindAlias(alias, entry);
    entry.aliases.clear();
    for (const alias of entry.renameAliases) {
      const indexed = renameAliases.get(alias);
      indexed?.delete(entry);
      if (indexed?.size === 0) renameAliases.delete(alias);
    }
    entry.renameAliases.clear();
    for (const scope of entry.scopes) {
      for (const key of entry.scopeDirectories.get(scope) ?? []) {
        const contributors = scope.directories.get(key)! - 1;
        if (contributors === 0) scope.directories.delete(key);
        else scope.directories.set(key, contributors);
      }
      scope.entries.delete(entry);
      if (scope.entries.size === 0 && !scope.pinned) closeScope(scope);
      else scopesToPrune.add(scope);
    }
    entry.scopeDirectories.clear();
    entry.scopes.clear();
    for (const file of entry.links) {
      const link = links.get(file);
      link?.inputs.delete(entry);
      if (link?.inputs.size === 0) links.delete(file);
    }
    entry.links.clear();
    // Component resolution is only an observation-time optimization. Entries
    // can introduce arbitrary missing ancestors, so discard the shared memo
    // when one leaves rather than retaining its path components indefinitely.
    componentLinks.clear();
    missingComponents.clear();
    if (links.size === 0) linkIterator = undefined;
    if (polled.size === 0) pollIterator = undefined;
    if (topologyChanged) pathIdentityMemosDirty = true;
  };

  const check = (
    selected: Iterable<InputEntry>,
    report: (change: InputObserverChange) => void = onChanged,
  ): void => {
    const current = [...selected].filter(
      (entry) => entries.get(entry.file) === entry,
    );
    const baselines = captureWatchInputBaselines(
      current
        .filter((entry) =>
          [...entry.conditions.values()].some((condition) => {
            const codec = condition.evidence?.state?.codec;
            return (
              codec !== "membership" &&
              codec !== "tree" &&
              codec !== "predicates"
            );
          }),
        )
        .map((entry) => entry.file),
    );
    const reloaded = new Set<string>();
    const invalidated = new Set<string>();
    // Minted before the first plugin source this check proves, as a delivery
    // mints before its reads: the source's file metadata stands for its bytes
    // only against a reference minted since any rollback. The observer holds no
    // generation, so it mints in the probe directory this process keeps.
    let referenceMinted = false;
    for (const entry of current) {
      if (entries.get(entry.file) !== entry) continue;
      const baseline = baselines.get(entry.file);
      let removedCondition = false;
      for (const [key, condition] of entry.conditions) {
        const state = condition.evidence?.state;
        let changed: boolean;
        if (state?.codec === "membership") {
          if (
            projectMembershipMatches(
              entry.file,
              state,
              DEFAULT_FILESYSTEM_OPERATIONS,
            )
          ) {
            continue;
          }
          for (const owner of condition.owners) invalidated.add(owner);
          entry.conditions.delete(key);
          removedCondition = true;
          continue;
        }
        if (state?.codec === "tree") {
          if (!referenceMinted) {
            refreshProcessClockReference(
              projectRoot ?? entry.file,
              DEFAULT_FILESYSTEM_OPERATIONS,
            );
            referenceMinted = true;
          }
          changed = !pluginSourceHolds(
            entry.file,
            state.digest,
            DEFAULT_FILESYSTEM_OPERATIONS,
            undefined,
            projectRoot,
          );
        } else if (state?.codec === "predicates") {
          changed =
            validateGraphInputObservation(entry.file, state.observation)
              .length !== 0;
        } else {
          changed =
            baseline === undefined ||
            (condition.evidence?.state !== undefined
              ? !watchInputEvidenceMatchesBaseline(condition.evidence, baseline)
              : JSON.stringify(condition.baseline) !==
                JSON.stringify(baseline));
        }
        if (!changed) continue;
        for (const owner of condition.owners) reloaded.add(owner);
        entry.conditions.delete(key);
        removedCondition = true;
      }
      if (entry.conditions.size === 0) {
        remove(entry);
      } else if (removedCondition) {
        refreshConditionCoverage(entry);
      }
    }
    if (pathIdentityMemosDirty) resetPathIdentityMemos();
    updatePoller();
    for (const owner of reloaded) invalidated.delete(owner);
    if (reloaded.size !== 0 || invalidated.size !== 0) {
      report({ invalidate: invalidated, reload: reloaded });
    }
  };

  const enqueue = (
    scope: WatchScope,
    eventType: string,
    file: string,
  ): void => {
    recordChange(eventType, path.resolve(file));
    scope.lastEventAt = changeSequence;
    // Native event names can be aliases absent from the lexical indexes, even
    // after the named entry has been deleted. Recheck this watch's owned inputs;
    // only changed conditions report an owner, and one settled batch deduplicates
    // repeated events without widening the native subscription tree.
    for (const entry of scope.entries) {
      entry.changedAt = changeSequence;
      pending.add(entry);
    }
    scheduleFlush();
  };

  const bindAlias = (entry: InputEntry, alias: string): void => {
    for (const key of watchEventKeys(alias)) {
      if (entry.aliases.has(key)) continue;
      entry.aliases.add(key);
      let indexed = aliases.get(key);
      if (indexed === undefined) {
        indexed = new Set();
        aliases.set(key, indexed);
      }
      indexed.add(entry);
    }
  };

  const bindRenameAncestors = (entry: InputEntry, file: string): void => {
    let current = path.dirname(path.resolve(file));
    for (;;) {
      for (const key of watchEventKeys(current)) {
        if (!entry.renameAliases.has(key)) {
          entry.renameAliases.add(key);
          let indexed = renameAliases.get(key);
          if (indexed === undefined) {
            indexed = new Set();
            renameAliases.set(key, indexed);
          }
          indexed.add(entry);
        }
      }
      const parent = path.dirname(current);
      if (parent === current) return;
      current = parent;
    }
  };

  const ensureScope = (
    root: string,
    external: boolean,
    pinned = false,
  ): WatchScope | undefined => {
    root = path.resolve(root);
    const key = watchPathKey(root);
    let scope =
      scopes.get(key) ??
      [...scopes.values()].find((candidate) => candidate.root === root);
    if (external && scope === undefined) {
      // A recursive observer can admit more descendants without another
      // native handle. Require exact lexical descent as well as current
      // physical descent: an unknown case policy or an escaping junction
      // cannot lend a different directory the old observer's authority.
      let physicalRoot: string | undefined;
      for (const candidate of scopes.values()) {
        if (
          candidate.pinned ||
          candidate.failed ||
          candidate.watcher === undefined ||
          !root.startsWith(`${candidate.root}${path.sep}`)
        )
          continue;
        if (
          candidate.identity === undefined ||
          watchLocationIdentity(
            candidate.root,
            DEFAULT_FILESYSTEM_OPERATIONS,
          ) !== candidate.identity
        ) {
          failScope(candidate);
          continue;
        }
        const physicalScope = realpath(candidate.root);
        physicalRoot ??= realpath(root);
        if (
          physicalScope !== undefined &&
          physicalRoot !== undefined &&
          (physicalRoot === physicalScope ||
            physicalRoot.startsWith(`${physicalScope}${path.sep}`))
        ) {
          if (
            watchLocationIdentity(
              candidate.root,
              DEFAULT_FILESYSTEM_OPERATIONS,
            ) !== candidate.identity
          ) {
            failScope(candidate);
            continue;
          }
          scope = candidate;
          break;
        }
      }
    }
    if (scope === undefined) {
      if (
        external &&
        [...scopes.values()].filter((candidate) => !candidate.pinned).length >=
          MAX_EXTERNAL_WATCH_SCOPES
      )
        return undefined;
      // Opening a scope is itself an observation boundary. Advance the same
      // sequence returned by begin() so an external scope first discovered
      // after compilation cannot claim it was already live at that token when
      // no filesystem event happened in between.
      changeSequence += 1;
      scope = {
        directories: new Map(),
        entries: new Set(),
        failed: false,
        identity: watchLocationIdentity(root, DEFAULT_FILESYSTEM_OPERATIONS),
        pinned,
        root,
        lastEventAt: 0,
        startedAt: changeSequence,
      };
      scopes.set(key, scope);
      try {
        const owned = scope;
        scope.watcher = open(
          root,
          (eventType, file) => {
            if (scopes.get(key) !== owned || owned.failed) return;
            if (!scopeLocationHolds(owned)) {
              failScope(owned);
              updatePoller();
              return;
            }
            if (file === null) {
              resetPathIdentityMemos();
              changeSequence += 1;
              owned.lastEventAt = changeSequence;
              historyFloor = changeSequence;
              changes.clear();
              for (const candidate of owned.entries) {
                candidate.changedAt = changeSequence;
                pending.add(candidate);
              }
              scheduleFlush();
              return;
            }
            enqueue(
              owned,
              eventType,
              path.isAbsolute(file) ? file : path.resolve(root, file),
            );
          },
          () => {
            if (scopes.get(key) !== owned || owned.failed) return;
            failScope(owned);
            updatePoller();
          },
          (directory) =>
            owned.directories.has(watchPathKey(directory)) ||
            admitsMembership(owned, directory) ||
            admitsTree(owned, directory),
          // Only the project's own scope may be proven through a probe below
          // its tool cache; an external one is not the adapter's to write in.
          external ? undefined : root,
        );
        if (scope.failed || !scopeLocationHolds(scope)) {
          // An injected or platform watcher may report failure synchronously
          // during construction, before its handle can be assigned above.
          if (scope.failed) {
            const watcher = scope.watcher;
            scope.watcher = undefined;
            try {
              watcher?.close();
            } catch {}
          } else failScope(scope);
        }
      } catch {
        scope.failed = true;
      }
    } else if (pinned) {
      scope.pinned = true;
    }
    return scope;
  };

  const bindScope = (
    root: string,
    entry: InputEntry,
    external: boolean,
    file: string,
  ): boolean => {
    if (polling) return false;
    // An ancestor of the project root belongs to the machine, not to the
    // project: TypeScript-Go probes `node_modules` in every ancestor, so a
    // missing probe there would otherwise open a recursive observer on a home
    // or `AppData` directory (samchon/ttsc#1411). Such an entry is polled
    // instead; the project root itself is the pinned scope's.
    if (
      external &&
      project !== undefined &&
      (containsPath(root, project.spelling) ||
        containsPath(root, project.physical))
    ) {
      return false;
    }
    const scope = ensureScope(root, external, !external);
    if (scope === undefined) return false;
    if (external && scope.root !== path.resolve(root)) {
      // Admission is new even though the ancestor handle predates the
      // compilation. Replay this entry's condition over that subscription
      // window; later deliveries can share the established coverage.
      changeSequence += 1;
      entry.changedAt = changeSequence;
    }
    scope.entries.add(entry);
    entry.scopes.add(scope);
    let contributed = entry.scopeDirectories.get(scope);
    if (contributed === undefined) {
      contributed = new Set();
      entry.scopeDirectories.set(scope, contributed);
    }
    // A directory-level backend hears only the directories it watches
    // (samchon/ttsc#1389): those leading to what its scope covers, and the
    // covered path itself, whose own entries decide a listing predicate and
    // whatever appears below a missing one. The path is watched only while it
    // is a directory, so a file input costs nothing.
    for (
      let directory = path.resolve(file);
      directory !== scope.root && containsPath(scope.root, directory);
      directory = path.dirname(directory)
    ) {
      const directoryKey = watchPathKey(directory);
      if (contributed.has(directoryKey)) break;
      contributed.add(directoryKey);
      scope.directories.set(
        directoryKey,
        (scope.directories.get(directoryKey) ?? 0) + 1,
      );
    }
    scope.watcher?.track?.(file);
    return !scope.failed;
  };

  /** Hand a scope that can no longer observe its root to the bounded poll. */
  function failScope(scope: WatchScope): void {
    if (scope.failed) return;
    scope.failed = true;
    const watcher = scope.watcher;
    scope.watcher = undefined;
    resetPathIdentityMemos();
    changeSequence += 1;
    scope.lastEventAt = changeSequence;
    historyFloor = changeSequence;
    changes.clear();
    try {
      watcher?.close();
    } catch {
      // The fallback owns validation now; a failed native handle is no
      // longer useful, and cleanup must not replace that recovery.
    }
    for (const entry of scope.entries) {
      requirePolling(entry);
      entry.changedAt = changeSequence;
      pending.add(entry);
    }
    scheduleFlush();
  }

  /** Native authority requires a readable, unchanged physical directory. */
  function scopeLocationHolds(scope: WatchScope): boolean {
    return (
      scope.identity !== undefined &&
      watchLocationIdentity(scope.root, DEFAULT_FILESYSTEM_OPERATIONS) ===
        scope.identity
    );
  }

  /** Occupied native scopes whose locations need verification. */
  function verifiableScopes(): WatchScope[] {
    return [...scopes.values()].filter(
      (scope) => !scope.failed && scope.entries.size !== 0,
    );
  }

  function requirePolling(entry: InputEntry): void {
    entry.fallback = true;
    if (polled.size === 0) pollIterator = undefined;
    polled.add(entry);
  }

  const scheduleFlush = (): void => {
    if (pending.size === 0 || flushTimer !== undefined) return;
    // Freeze this wave, leaving events arriving between turns in pending for
    // the next wave. No path observation or identity context crosses a yield.
    let selected: InputEntry[] | undefined;
    const reload = new Map<string, object>();
    const invalidate = new Map<string, object>();
    let offset = 0;
    const flush = (): void => {
      if (selected === undefined) {
        selected = [...pending];
        pending.clear();
      }
      const chunk = selected.slice(offset, offset + MAX_EVENT_PROBES_PER_TURN);
      offset += chunk.length;
      check(chunk, (change) => {
        for (const owner of change.reload) {
          const registration = ownerRegistrations.get(owner);
          if (registration !== undefined) reload.set(owner, registration);
        }
        for (const owner of change.invalidate) {
          const registration = ownerRegistrations.get(owner);
          if (registration !== undefined) invalidate.set(owner, registration);
        }
      });
      if (offset < selected.length) {
        flushTimer = setTimeout(flush, 0);
        flushTimer.unref();
        return;
      }
      flushTimer = undefined;
      // A replacement can answer the old registration while this wave yields.
      // Only its own still-current registration may receive a delayed effect.
      for (const [owner, registration] of reload) {
        if (ownerRegistrations.get(owner) !== registration)
          reload.delete(owner);
      }
      for (const [owner, registration] of invalidate)
        if (ownerRegistrations.get(owner) !== registration || reload.has(owner))
          invalidate.delete(owner);
      if (reload.size !== 0 || invalidate.size !== 0)
        onChanged({
          invalidate: new Set(invalidate.keys()),
          reload: new Set(reload.keys()),
        });
      scheduleFlush();
    };
    flushTimer = setTimeout(flush, 0);
    flushTimer.unref();
  };

  function updatePoller(): void {
    // One native retirement pass per affected scope at the atomic boundary,
    // rather than scanning all subscriptions once per removed input.
    for (const scope of scopesToPrune) {
      try {
        scope.watcher?.prune?.();
      } catch {
        failScope(scope);
      }
    }
    scopesToPrune.clear();
    const needed =
      links.size !== 0 || polled.size !== 0 || verifiableScopes().length !== 0;
    if (!needed) {
      const ownedPoller = poller;
      poller = undefined;
      try {
        ownedPoller?.close();
      } catch {
        // Relinquish this handle without blocking unrelated registrations.
      }
      return;
    }
    if (poller !== undefined) return;
    let active = true;
    const ownedPoller = openPoller(() => {
      if (!active) return;
      const selected = new Set<InputEntry>();
      // One metadata call per occupied observer, at most 17 locations: a
      // root replaced since it opened is watched no longer, so its entries are
      // checked now and polled from then on.
      for (const scope of verifiableScopes()) {
        if (!scopeLocationHolds(scope)) {
          failScope(scope);
          for (const entry of scope.entries) selected.add(entry);
        }
      }
      for (
        let count = 0;
        count < MAX_FALLBACK_PROBES_PER_TICK && polled.size !== 0;
        count += 1
      ) {
        pollIterator ??= polled.values();
        let next = pollIterator.next();
        if (next.done) {
          pollIterator = polled.values();
          next = pollIterator.next();
        }
        if (next.done) break;
        selected.add(next.value);
      }
      // Files reached through one linked directory share one topology check.
      // Content edits remain event-driven; retargeting a junction does not
      // reliably emit an event on its previously watched descendants. Reconcile
      // a fixed-size slice as a safety net; ordinary retargets arrive at once
      // through the project-root observer. Probe counts are bounded, but a
      // retarget can fan out to all dependent entries, and native/query/content
      // work for selected inputs is not a constant CPU or byte bound.
      for (
        let count = 0;
        count < MAX_LINK_PROBES_PER_TICK && links.size !== 0;
        count += 1
      ) {
        linkIterator ??= links.entries();
        let next = linkIterator.next();
        if (next.done) {
          linkIterator = links.entries();
          next = linkIterator.next();
        }
        if (next.done) break;
        const [file, link] = next.value;
        const target = realpath(file);
        if (target !== link.target) {
          link.target = target;
          for (const entry of link.inputs) {
            selected.add(entry);
          }
        }
      }
      const probes = [...selected];
      // Preserve the poll's immediate bounded slice. A replaced scope or one
      // retargeted link can fan out beyond that slice; only its remainder must
      // yield through the same current-state event queue.
      check(probes.slice(0, MAX_FALLBACK_PROBES_PER_TICK));
      for (const entry of probes.slice(MAX_FALLBACK_PROBES_PER_TICK))
        pending.add(entry);
      scheduleFlush();
    });
    poller = {
      close() {
        active = false;
        ownedPoller.close();
      },
    };
  }

  // The entry under the project root's own name, when the project contains
  // it: the scope's events name the root as it was opened, so an input spelled
  // under the physical root is heard under that name, and the scope's
  // directory-level backend admits the directories leading to it.
  const namedInProject = (file: string): string | undefined => {
    if (projectRoot === undefined || project === undefined) return undefined;
    const below = relativeToProject(file, project);
    return below === undefined ? undefined : path.join(projectRoot, below);
  };

  const observe = (entry: InputEntry): void => {
    bindAlias(entry, entry.file);
    bindRenameAncestors(entry, entry.file);
    if (directoryCaseSensitivity.get(path.dirname(entry.file)) === undefined)
      requirePolling(entry);
    const root = projectRoot;
    const named = namedInProject(entry.file);
    if (root !== undefined && named !== undefined) {
      bindAlias(entry, named);
      bindRenameAncestors(entry, named);
      if (!bindScope(root, entry, false, named)) requirePolling(entry);
    } else {
      const external = nearestExistingDirectory(entry.file);
      if (
        external === undefined ||
        !bindScope(external, entry, true, entry.file)
      )
        requirePolling(entry);
    }

    const target = realpath(entry.file);
    if (hasMultipleLinks(entry.file)) requirePolling(entry);
    if (target !== undefined) {
      bindAlias(entry, target);
      bindRenameAncestors(entry, target);
      if (watchPathKey(entry.file) !== watchPathKey(target)) {
        let link = links.get(entry.file);
        if (link === undefined) {
          link = { target, inputs: new Set() };
          if (links.size === 0) linkIterator = undefined;
          links.set(entry.file, link);
        }
        link.inputs.add(entry);
        entry.links.add(entry.file);
        const namedTarget = namedInProject(target);
        if (root !== undefined && namedTarget !== undefined) {
          // The project scope hears the target; a directory-level backend
          // needs its spelling as well.
          bindAlias(entry, namedTarget);
          bindRenameAncestors(entry, namedTarget);
          if (!bindScope(root, entry, false, namedTarget))
            requirePolling(entry);
        } else {
          const targetRoot = nearestExistingDirectory(target);
          if (
            targetRoot === undefined ||
            !bindScope(targetRoot, entry, true, target)
          )
            requirePolling(entry);
        }
      }
    }
    if (root !== undefined) {
      for (const linkedFile of linkedComponents(
        entry.file,
        root,
        componentLinks,
        missingComponents,
        watchPathKey,
      )) {
        bindAlias(entry, linkedFile);
        let link = links.get(linkedFile);
        if (link === undefined) {
          link = { target: realpath(linkedFile), inputs: new Set() };
          if (links.size === 0) linkIterator = undefined;
          links.set(linkedFile, link);
        }
        link.inputs.add(entry);
        entry.links.add(linkedFile);
        if (link.target === undefined) {
          requirePolling(entry);
          continue;
        }
        // A backend that resolves the link reports the entry under the link's
        // target, a spelling no other alias covers while the entry is missing.
        const targetFile = path.join(
          link.target,
          path.relative(linkedFile, entry.file),
        );
        bindAlias(entry, targetFile);
        bindRenameAncestors(entry, targetFile);
        const namedTargetFile = namedInProject(targetFile);
        if (namedTargetFile !== undefined) {
          bindAlias(entry, namedTargetFile);
          bindRenameAncestors(entry, namedTargetFile);
        }
        if (
          !bindScope(
            namedTargetFile === undefined ? link.target : root,
            entry,
            namedTargetFile === undefined,
            namedTargetFile ?? targetFile,
          )
        )
          requirePolling(entry);
      }
    }
  };

  return {
    open(root, declaredPolling) {
      const nextRoot = path.resolve(root);
      const currentRoot = [...scopes.values()].find((scope) => scope.pinned);
      const lostRoot =
        !polling &&
        currentRoot !== undefined &&
        (currentRoot.failed || !scopeLocationHolds(currentRoot));
      const reanchor =
        opened &&
        (projectRoot !== nextRoot || polling !== declaredPolling || lostRoot);
      const retained = reanchor ? [...entries.values()] : [];
      if (reanchor) {
        // Conditions and owner registrations survive a host restart, while
        // their old native scopes and lexical indexes belong to the old root.
        for (const entry of retained) remove(entry);
        for (const scope of [...scopes.values()]) closeScope(scope);
        pending.clear();
        if (flushTimer !== undefined) clearTimeout(flushTimer);
        flushTimer = undefined;
        resetPathIdentityMemos();
        changeSequence += 1;
        historyFloor = changeSequence;
      }
      opened = true;
      projectRoot = nextRoot;
      project = {
        physical: realpath(projectRoot) ?? projectRoot,
        spelling: projectRoot,
      };
      polling = declaredPolling;
      if (!polling) ensureScope(projectRoot, false, true);
      for (const entry of retained) {
        entry.fallback = false;
        entry.physical = undefined;
        entries.set(entry.file, entry);
        for (const condition of entry.conditions.values()) {
          if (condition.evidence?.state?.codec === "membership")
            memberships.add(entry);
          if (condition.evidence?.state?.codec === "tree") trees.add(entry);
        }
        if (memberships.has(entry) || trees.has(entry))
          entry.physical = realpath(entry.file) ?? entry.file;
        observe(entry);
      }
      updatePoller();
      // A reattachment can replace physical coverage without producing a
      // native event. Prove retained conditions after the new watch opens.
      if (lostRoot && retained.length !== 0) check(retained);
    },
    begin() {
      return changeSequence;
    },
    async dispose() {
      entries.clear();
      memberships.clear();
      trees.clear();
      aliases.clear();
      renameAliases.clear();
      ownerInputs.clear();
      ownerRegistrations.clear();
      pending.clear();
      polled.clear();
      links.clear();
      componentLinks.clear();
      missingComponents.clear();
      changes.clear();
      linkIterator = undefined;
      pollIterator = undefined;
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      const ownedPoller = poller;
      poller = undefined;
      flushTimer = undefined;
      try {
        ownedPoller?.close();
      } catch {
        // An injected poll handle cannot prevent independent scope cleanup.
      }
      for (const scope of [...scopes.values()]) closeScope(scope);
      scopesToPrune.clear();
      resetPathIdentityMemos();
      // Stays open on the root it opened on: an owner can keep delivering after
      // a disposal, as overlapping Vite restart containers do, and its inputs
      // are observed again as they register.
    },
    forget(owner) {
      owner = path.resolve(owner);
      const previous = ownerInputs.get(owner);
      if (previous === undefined) return;
      ownerInputs.delete(owner);
      ownerRegistrations.delete(owner);
      for (const [file, key] of previous) {
        const entry = entries.get(file);
        const condition = entry?.conditions.get(key);
        condition?.owners.delete(owner);
        if (condition?.owners.size === 0 && entry !== undefined) {
          entry.conditions.delete(key);
          refreshConditionCoverage(entry);
        }
        if (entry?.conditions.size === 0) remove(entry);
      }
      if (pathIdentityMemosDirty) resetPathIdentityMemos();
      updatePoller();
    },
    replace(owner, inputs, failed = false, startedAt) {
      if (!opened) return;
      // Validate once per location at this synchronous registration boundary,
      // never once per compiler input bound below. No observation survives
      // into a later registration or event turn.
      for (const scope of scopes.values())
        if (!scope.failed && !scopeLocationHolds(scope)) failScope(scope);
      owner = path.resolve(owner);
      ownerRegistrations.set(owner, {});
      const previous = ownerInputs.get(owner) ?? new Map<string, string>();
      if (failed) {
        // An exception can omit the dependency whose deletion caused it.
        // Keep the last successful spellings until a successful delivery can
        // replace them, observing their current failed state for recovery.
        const reported = new Set(
          inputs.map((input) => path.resolve(input.file)),
        );
        inputs = [
          ...inputs,
          ...[...previous.keys()]
            .filter((file) => !reported.has(file))
            .map((file) => ({ file })),
        ];
      }
      const current = new Map<string, string>();
      const added = new Set<InputEntry>();
      const touched = new Set<InputEntry>();
      // Memberships and plugin sources new to this replacement, checked at
      // once: a root file can have appeared, or a source file changed, after
      // the reading the state was taken from.
      const recorded = new Set<InputEntry>();
      for (const input of inputs) {
        const file = path.resolve(input.file);
        const evidence = input.evidence;
        const state = evidence?.state;
        // A membership is keyed by its digest alone, which covers its policy:
        // its directory list only grows the registration, and serializing it
        // for every module would cost the most on the largest projects.
        const key =
          state?.codec === "membership"
            ? `membership\0${state.digest}`
            : JSON.stringify(evidence ?? null);
        current.set(file, key);
        let entry = entries.get(file);
        if (entry === undefined) {
          entry = {
            aliases: new Set(),
            changedAt: 0,
            file,
            conditions: new Map(),
            fallback: false,
            links: new Set(),
            renameAliases: new Set(),
            scopes: new Set(),
            scopeDirectories: new Map(),
          };
          entries.set(file, entry);
          added.add(entry);
          observe(entry);
        }
        touched.add(entry);
        let condition = entry.conditions.get(key);
        if (condition === undefined) {
          condition = {
            evidence,
            baseline:
              evidence?.state === undefined
                ? captureWatchInputBaseline(file)
                : undefined,
            owners: new Set(),
          };
          entry.conditions.set(key, condition);
          if (state?.codec === "membership") {
            memberships.add(entry);
            entry.physical ??= realpath(entry.file) ?? entry.file;
            recorded.add(entry);
            // Its scope now admits the walk's directories, which a
            // directory-level backend passed over before.
            for (const scope of entry.scopes) {
              scope.watcher?.track?.(entry.file, true);
            }
          } else if (state?.codec === "tree") {
            // A plugin's source is proven at once, as a membership is: a file
            // below it can have moved after the capture proved its state, and
            // its scope now admits the directories below it (samchon/ttsc#1487).
            trees.add(entry);
            entry.physical ??= realpath(entry.file) ?? entry.file;
            recorded.add(entry);
            for (const scope of entry.scopes) {
              scope.watcher?.track?.(entry.file, true);
            }
          }
        }
        condition.owners.add(owner);
      }
      for (const [file, key] of previous) {
        if (current.get(file) === key) continue;
        const entry = entries.get(file);
        const condition = entry?.conditions.get(key);
        condition?.owners.delete(owner);
        if (condition?.owners.size === 0 && entry !== undefined) {
          entry.conditions.delete(key);
          refreshConditionCoverage(entry);
        }
        if (entry?.conditions.size === 0 && !current.has(file)) {
          remove(entry);
        }
      }
      if (pathIdentityMemosDirty) resetPathIdentityMemos();
      if (current.size === 0) {
        ownerInputs.delete(owner);
        ownerRegistrations.delete(owner);
      } else ownerInputs.set(owner, current);
      // Registration and removal can each touch thousands of compiler inputs.
      // Decide the one shared poller's state once per atomic replacement,
      // rather than rescanning the whole graph once per input.
      updatePoller();
      // Watchers are live before this proof. It closes the compile-to-subscribe
      // race without manufacturing one native subscription per input.
      if (touched.size !== 0) {
        if (startedAt === undefined || startedAt < historyFloor) {
          check(touched);
        } else {
          const raced: InputEntry[] = [];
          for (const entry of touched) {
            if (
              entry.fallback ||
              entry.changedAt > startedAt ||
              recorded.has(entry)
            ) {
              raced.push(entry);
              continue;
            }
            const observedAfterCompile =
              added.has(entry) &&
              (someSet(
                entry.aliases,
                (alias) => (changes.get(alias) ?? 0) > startedAt,
              ) ||
                someSet(
                  entry.renameAliases,
                  (alias) => (changes.get(alias) ?? 0) > startedAt,
                ));
            if (
              someSet(
                entry.scopes,
                (scope) =>
                  scope.failed ||
                  scope.startedAt > startedAt ||
                  scope.lastEventAt > startedAt ||
                  observedAfterCompile,
              )
            ) {
              raced.push(entry);
            }
          }
          if (raced.length !== 0) check(raced);
        }
      }
    },
  };
}

const MAX_EXTERNAL_WATCH_SCOPES = 16;

const MAX_CHANGE_HISTORY = 100_000;

const MAX_FALLBACK_PROBES_PER_TICK = 64;

const MAX_EVENT_PROBES_PER_TURN = 64;

const MAX_LINK_PROBES_PER_TICK = 64;
