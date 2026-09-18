import fs from "node:fs";
import path from "node:path";
import { createFilesystemPathIdentityContext } from "ttsc/path-identity";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { validateGraphInputObservation } from "../transform/inputs/validateGraphInputObservation";
import { hostDeclaresPolling } from "../transform/tracker/hostDeclaresPolling";
import { watchLocationIdentity } from "../transform/tracker/watchLocationIdentity";
import type { TtscWatchInputBaseline } from "../transform/watch/TtscWatchInputBaseline";
import { captureWatchInputBaseline } from "../transform/watch/captureWatchInputBaseline";
import { watchInputEvidenceMatchesBaseline } from "../transform/watch/watchInputEvidenceMatchesBaseline";
import type { InputEntry } from "./InputEntry";
import type { LinkedPath } from "./LinkedPath";
import type { ViteDevServerLike } from "./ViteDevServerLike";
import type { ViteServeInputWatch } from "./ViteServeInputWatch";
import type { ViteServeWatchOperations } from "./ViteServeWatchOperations";
import type { WatchScope } from "./WatchScope";
import { containsPath } from "./containsPath";
import { hasMultipleLinks } from "./hasMultipleLinks";
import { linkedComponents } from "./linkedComponents";
import { nearestExistingDirectory } from "./nearestExistingDirectory";
import { openIsolatedRecursiveWatch } from "./openIsolatedRecursiveWatch";
import { openRecursiveWatch } from "./openRecursiveWatch";
import { openWatchPoller } from "./openWatchPoller";
import { realpath } from "./realpath";
import { reloadImporters } from "./reloadImporters";
import { sameSpelling } from "./sameSpelling";
import { someSet } from "./someSet";

/**
 * A bounded recursive filesystem observer shared by all served modules.
 *
 * Vite resolves transform-context addWatchFile as a runtime import, including
 * type-only .server files and non-module plugin assets. Use a separate watcher
 * for compiler inputs, including node_modules, which Vite's watcher ignores.
 * Ordinary files use events after their initial subscription is observed.
 * Missing spellings and directory predicates use the recursive observer for
 * their nearest available scope. Inputs a native scope cannot safely cover
 * share one bounded fallback poll; linked files also share topology checks
 * because retargeting a junction need not emit events on its old descendants.
 */
export function createViteServeInputWatch(
  operations: Partial<ViteServeWatchOperations> = {},
): ViteServeInputWatch {
  const entries = new Map<string, InputEntry>();
  const aliases = new Map<string, Set<InputEntry>>();
  const renameAliases = new Map<string, Set<InputEntry>>();
  const importerInputs = new Map<string, Map<string, string>>();
  const pending = new Set<InputEntry>();
  const polled = new Set<InputEntry>();
  const links = new Map<string, LinkedPath>();
  const scopes = new Map<string, WatchScope>();
  const componentLinks = new Map<string, string | null>();
  const missingComponents = new Set<string>();
  const changes = new Map<string, number>();
  let server: ViteDevServerLike | undefined;
  let projectRoot: string | undefined;
  // Whether the server declared polling, which leaves native notifications
  // unproven on its filesystem, so every entry goes to the bounded poll
  // (samchon/ttsc#1395).
  let polling = false;
  let changeSequence = 0;
  let historyFloor = 0;
  let linkIterator: MapIterator<[string, LinkedPath]> | undefined;
  let pollIterator: SetIterator<InputEntry> | undefined;
  let poller: { close(): void } | undefined;
  let flushTimer: NodeJS.Timeout | undefined;

  // Windows runs every native observer in the isolated watch broker, so an
  // abort in Node's fs-event backend cannot take the dev server down with it
  // (samchon/ttsc#1411).
  const open =
    operations.watch ??
    (process.platform === "win32"
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
  const directoryCaseSensitivity = new Map<string, boolean>();
  let pathIdentityMemosDirty = false;

  /** Drop path facts after topology or ownership changes make them stale. */
  const resetPathIdentityMemos = (): void => {
    caseIdentities = createCaseIdentities();
    directoryCaseSensitivity.clear();
    pathIdentityMemosDirty = false;
  };

  /** Lexical event key under the nearest existing directory's case policy. */
  const watchPathKey = (file: string): string => {
    const absolute = path.resolve(file);
    if (platform !== "win32" && platform !== "darwin") {
      return absolute;
    }
    let current = path.dirname(absolute);
    const traversed: string[] = [];
    let sensitive: boolean | undefined;
    for (;;) {
      const cacheKey = platform === "win32" ? current.toLowerCase() : current;
      sensitive = directoryCaseSensitivity.get(cacheKey);
      if (sensitive !== undefined) break;
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
        // The shared identity resolver uses the platform default when even the
        // volume root cannot answer the read-only case-sensitivity probe.
        sensitive = caseIdentities.caseSensitive(current);
        break;
      }
      current = parent;
    }
    for (const directory of traversed) {
      directoryCaseSensitivity.set(directory, sensitive);
    }
    return sensitive ? absolute : absolute.toLowerCase();
  };

  const unbindAlias = (alias: string, entry: InputEntry): void => {
    const indexed = aliases.get(alias);
    indexed?.delete(entry);
    if (indexed?.size === 0) aliases.delete(alias);
  };

  const closeScope = (scope: WatchScope): void => {
    scopes.delete(watchPathKey(scope.root));
    try {
      scope.watcher?.close();
    } catch {
      // The generation no longer trusts this scope, so cleanup is best effort.
    }
    scope.watcher = undefined;
  };

  const recordChange = (
    eventType: string,
    file: string,
  ): { direct: Set<string>; parent: Set<string> } => {
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
    }
    changeSequence += 1;
    direct.add(watchPathKey(absolute));
    parents.add(watchPathKey(parent));
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
    return { direct, parent: parents };
  };

  const remove = (entry: InputEntry): void => {
    entries.delete(entry.file);
    pending.delete(entry);
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
      scope.entries.delete(entry);
      if (scope.entries.size === 0 && !scope.pinned) closeScope(scope);
    }
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
    pathIdentityMemosDirty = true;
  };

  const check = (selected: Iterable<InputEntry>): void => {
    const importers = new Set<string>();
    for (const entry of selected) {
      if (entries.get(entry.file) !== entry) continue;
      let baseline: TtscWatchInputBaseline | undefined;
      for (const [key, condition] of entry.conditions) {
        const state = condition.evidence?.state;
        let changed: boolean;
        if (state?.codec === "predicates") {
          changed =
            validateGraphInputObservation(entry.file, state.observation)
              .length !== 0;
        } else {
          baseline ??= captureWatchInputBaseline(entry.file);
          changed =
            baseline === undefined ||
            (condition.evidence?.state !== undefined
              ? !watchInputEvidenceMatchesBaseline(condition.evidence, baseline)
              : JSON.stringify(condition.baseline) !==
                JSON.stringify(baseline));
        }
        if (!changed) continue;
        for (const importer of condition.importers) importers.add(importer);
        entry.conditions.delete(key);
      }
      if (entry.conditions.size === 0) {
        remove(entry);
      }
    }
    if (pathIdentityMemosDirty) resetPathIdentityMemos();
    updatePoller();
    if (server !== undefined && importers.size !== 0) {
      reloadImporters(server, importers);
    }
  };

  const enqueue = (eventType: string, file: string): void => {
    const absolute = path.resolve(file);
    const eventKeys = recordChange(eventType, absolute);
    for (const key of eventKeys.direct) {
      for (const entry of aliases.get(key) ?? []) {
        entry.changedAt = changeSequence;
        pending.add(entry);
      }
    }
    for (const key of eventKeys.parent) {
      for (const entry of aliases.get(key) ?? []) {
        entry.changedAt = changeSequence;
        pending.add(entry);
      }
    }
    if (eventType === "rename") {
      const exact = new Set<InputEntry>();
      for (const key of eventKeys.direct) {
        for (const entry of renameAliases.get(key) ?? []) exact.add(entry);
      }
      // Linux may report only the destination spelling of a directory rename.
      // That spelling cannot be indexed before the move. Fall back to the
      // renamed entry's parent only when no exact old spelling matched; the
      // baseline check below still invalidates solely inputs that really moved.
      const selected = exact;
      if (selected.size === 0) {
        for (const key of eventKeys.parent) {
          for (const entry of renameAliases.get(key) ?? []) selected.add(entry);
        }
      }
      for (const entry of selected) {
        entry.changedAt = changeSequence;
        pending.add(entry);
      }
    }
    scheduleFlush();
  };

  const bindAlias = (entry: InputEntry, alias: string): void => {
    alias = watchPathKey(alias);
    if (entry.aliases.has(alias)) return;
    entry.aliases.add(alias);
    let indexed = aliases.get(alias);
    if (indexed === undefined) {
      indexed = new Set();
      aliases.set(alias, indexed);
    }
    indexed.add(entry);
  };

  const bindRenameAncestors = (entry: InputEntry, file: string): void => {
    let current = path.dirname(path.resolve(file));
    for (;;) {
      const key = watchPathKey(current);
      if (!entry.renameAliases.has(key)) {
        entry.renameAliases.add(key);
        let indexed = renameAliases.get(key);
        if (indexed === undefined) {
          indexed = new Set();
          renameAliases.set(key, indexed);
        }
        indexed.add(entry);
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
    let scope = scopes.get(key);
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
        directories: new Set(),
        entries: new Set(),
        failed: false,
        ...(external
          ? {
              identity: watchLocationIdentity(
                root,
                DEFAULT_FILESYSTEM_OPERATIONS,
              ),
            }
          : {}),
        pinned,
        root,
        startedAt: changeSequence,
      };
      scopes.set(key, scope);
      try {
        const owned = scope;
        scope.watcher = open(
          root,
          (eventType, file) => {
            if (scopes.get(key) !== owned) return;
            if (file === null) {
              resetPathIdentityMemos();
              changeSequence += 1;
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
              eventType,
              path.isAbsolute(file) ? file : path.resolve(root, file),
            );
          },
          () => {
            if (scopes.get(key) !== owned) return;
            failScope(owned);
            updatePoller();
          },
          (directory) => owned.directories.has(watchPathKey(directory)),
        );
        if (scope.failed) {
          // An injected or platform watcher may report failure synchronously
          // during construction, before its handle can be assigned above.
          try {
            scope.watcher?.close();
          } catch {}
          scope.watcher = undefined;
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
      projectRoot !== undefined &&
      containsPath(root, projectRoot)
    ) {
      return false;
    }
    const scope = ensureScope(root, external);
    if (scope === undefined) return false;
    scope.entries.add(entry);
    entry.scopes.add(scope);
    // A directory-level backend hears only the directories leading to what
    // its scope covers (samchon/ttsc#1389).
    for (
      let directory = path.dirname(path.resolve(file));
      directory !== scope.root && containsPath(scope.root, directory);
      directory = path.dirname(directory)
    ) {
      const directoryKey = watchPathKey(directory);
      if (scope.directories.has(directoryKey)) break;
      scope.directories.add(directoryKey);
    }
    scope.watcher?.track?.(file);
    return !scope.failed;
  };

  /** Hand a scope that can no longer observe its root to the bounded poll. */
  function failScope(scope: WatchScope): void {
    scope.failed = true;
    try {
      scope.watcher?.close();
    } catch {
      // The fallback owns validation now; a failed native handle is no
      // longer useful, and cleanup must not replace that recovery.
    }
    scope.watcher = undefined;
    for (const entry of scope.entries) requirePolling(entry);
  }

  /** External observers whose root the poll re-checks each tick. */
  function verifiableScopes(): WatchScope[] {
    return [...scopes.values()].filter(
      (scope) => !scope.failed && scope.identity !== undefined,
    );
  }

  function requirePolling(entry: InputEntry): void {
    entry.fallback = true;
    if (polled.size === 0) pollIterator = undefined;
    polled.add(entry);
  }

  const scheduleFlush = (): void => {
    if (pending.size === 0 || flushTimer !== undefined) return;
    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      const selected = [...pending];
      pending.clear();
      check(selected);
    }, 0);
    flushTimer.unref();
  };

  function updatePoller(): void {
    const needed =
      links.size !== 0 || polled.size !== 0 || verifiableScopes().length !== 0;
    if (!needed) {
      poller?.close();
      poller = undefined;
      return;
    }
    if (poller !== undefined) return;
    poller = openPoller(() => {
      const selected = new Set<InputEntry>();
      // One metadata call per external observer, at most the scope bound: a
      // root replaced since it opened is watched no longer, so its entries are
      // checked now and polled from then on.
      for (const scope of verifiableScopes()) {
        if (
          watchLocationIdentity(scope.root, DEFAULT_FILESYSTEM_OPERATIONS) !==
          scope.identity
        ) {
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
      // through the project-root observer, while even an enormous dependency
      // graph has constant idle CPU cost.
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
      check(selected);
    });
  }

  const observe = (entry: InputEntry): void => {
    bindAlias(entry, entry.file);
    bindRenameAncestors(entry, entry.file);
    const root = projectRoot;
    if (root !== undefined && containsPath(root, entry.file)) {
      if (!bindScope(root, entry, false, entry.file)) requirePolling(entry);
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
      if (!sameSpelling(entry.file, target)) {
        let link = links.get(entry.file);
        if (link === undefined) {
          link = { target, inputs: new Set() };
          if (links.size === 0) linkIterator = undefined;
          links.set(entry.file, link);
        }
        link.inputs.add(entry);
        entry.links.add(entry.file);
        if (root !== undefined && containsPath(root, target)) {
          // The project scope hears the target; a directory-level backend
          // needs its spelling as well.
          if (!bindScope(root, entry, false, target)) requirePolling(entry);
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
        const inRoot = containsPath(root, link.target);
        if (!bindScope(inRoot ? root : link.target, entry, !inRoot, targetFile))
          requirePolling(entry);
      }
    }
  };

  return {
    attach(next) {
      server = next;
      projectRoot = path.resolve(next.config?.root ?? process.cwd());
      polling = hostDeclaresPolling(
        process.env,
        next.config?.server?.watch?.usePolling === true,
      );
      if (!polling) ensureScope(projectRoot, false, true);
    },
    begin() {
      return changeSequence;
    },
    async dispose() {
      entries.clear();
      aliases.clear();
      renameAliases.clear();
      importerInputs.clear();
      pending.clear();
      polled.clear();
      links.clear();
      componentLinks.clear();
      missingComponents.clear();
      changes.clear();
      linkIterator = undefined;
      pollIterator = undefined;
      poller?.close();
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      poller = undefined;
      flushTimer = undefined;
      for (const scope of [...scopes.values()]) closeScope(scope);
      resetPathIdentityMemos();
      // Retain the attached server across overlapping Vite restart containers.
    },
    forget(importer) {
      importer = path.resolve(importer);
      const previous = importerInputs.get(importer);
      if (previous === undefined) return;
      importerInputs.delete(importer);
      for (const [file, key] of previous) {
        const entry = entries.get(file);
        const condition = entry?.conditions.get(key);
        condition?.importers.delete(importer);
        if (condition?.importers.size === 0) entry?.conditions.delete(key);
        if (entry?.conditions.size === 0) remove(entry);
      }
      if (pathIdentityMemosDirty) resetPathIdentityMemos();
      updatePoller();
    },
    replace(importer, inputs, failed = false, startedAt) {
      if (server === undefined) return;
      importer = path.resolve(importer);
      const previous =
        importerInputs.get(importer) ?? new Map<string, string>();
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
      for (const input of inputs) {
        const file = path.resolve(input.file);
        const evidence = input.evidence;
        const key = JSON.stringify(evidence ?? null);
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
            importers: new Set(),
          };
          entry.conditions.set(key, condition);
        }
        condition.importers.add(importer);
      }
      for (const [file, key] of previous) {
        if (current.get(file) === key) continue;
        const entry = entries.get(file);
        const condition = entry?.conditions.get(key);
        condition?.importers.delete(importer);
        if (condition?.importers.size === 0) entry?.conditions.delete(key);
        if (entry?.conditions.size === 0 && !current.has(file)) {
          remove(entry);
        }
      }
      if (pathIdentityMemosDirty) resetPathIdentityMemos();
      if (current.size === 0) importerInputs.delete(importer);
      else importerInputs.set(importer, current);
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
            if (entry.fallback || entry.changedAt > startedAt) {
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

const MAX_LINK_PROBES_PER_TICK = 64;
