import fs from "node:fs";
import path from "node:path";
import { createFilesystemPathIdentityContext } from "ttsc/path-identity";

import {
  type TtscWatchInput,
  type TtscWatchInputBaseline,
  type TtscWatchInputEvidence,
  captureWatchInputBaseline,
  pathIdentityKey,
  validateGraphInputObservation,
  watchInputEvidenceMatchesBaseline,
} from "./transform";

/** One module node inside a Vite module graph; opaque to this module. */
type ViteModuleNodeLike = object;

/**
 * The module-graph surface this module touches, shared by Vite's mixed module
 * graph and the per-environment graphs of the environment API.
 */
interface ViteModuleGraphLike {
  fileToModulesMap?: Map<string, Set<ViteModuleNodeLike>>;
  getModulesByFile?(file: string): Set<ViteModuleNodeLike> | undefined;
  invalidateModule?(node: ViteModuleNodeLike): void;
}

/** A channel that can deliver a full-reload event to connected clients. */
interface ViteHotChannelLike {
  send?(payload: { path?: string; type: "full-reload" }): void;
}

/** One dev-server environment (client, ssr, or a custom one). */
interface ViteEnvironmentLike {
  hot?: ViteHotChannelLike;
  moduleGraph?: ViteModuleGraphLike;
}

/**
 * Minimal structural view of the Vite dev server. Declared locally instead of
 * importing `vite` so the published type declarations never require Vite to be
 * installed, and so one shape spans the mixed module graph (Vite 5), the
 * environment API (Vite 6+), and whichever of `ws`/`hot` a major still
 * carries.
 */
export interface ViteDevServerLike {
  config?: { root?: string };
  environments?: Record<string, ViteEnvironmentLike>;
  hot?: ViteHotChannelLike;
  moduleGraph?: ViteModuleGraphLike;
  ws?: ViteHotChannelLike;
}

interface InputCondition {
  baseline?: TtscWatchInputBaseline;
  evidence?: TtscWatchInputEvidence;
  importers: Set<string>;
}

interface InputEntry {
  aliases: Set<string>;
  /** Latest native event already associated with this registered spelling. */
  changedAt: number;
  conditions: Map<string, InputCondition>;
  fallback: boolean;
  file: string;
  links: Set<string>;
  renameAliases: Set<string>;
  scopes: Set<WatchScope>;
}

interface LinkedPath {
  target: string | undefined;
  inputs: Set<InputEntry>;
}

interface WatchScope {
  entries: Set<InputEntry>;
  failed: boolean;
  root: string;
  pinned: boolean;
  startedAt: number;
  watcher?: { close(): void };
}

export interface ViteServeWatchOperations {
  poll(listener: () => void): { close(): void };
  watch(
    root: string,
    listener: (eventType: string, file: string | null) => void,
    onError: () => void,
  ): { close(): void };
}

/** Serve-time compiler dependencies never enter Vite's runtime import graph. */
export interface ViteServeInputWatch {
  attach(server: ViteDevServerLike): void;
  begin(): number;
  dispose(): Promise<void>;
  replace(
    importer: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}

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
  let changeSequence = 0;
  let historyFloor = 0;
  let linkIterator: MapIterator<[string, LinkedPath]> | undefined;
  let pollIterator: SetIterator<InputEntry> | undefined;
  let poller: { close(): void } | undefined;
  let flushTimer: NodeJS.Timeout | undefined;

  const open = operations.watch ?? openRecursiveWatch;
  const openPoller = operations.poll ?? openWatchPoller;
  const caseIdentities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  const directoryCaseSensitivity = new Map<string, boolean>();

  /** Lexical event key under the nearest existing directory's case policy. */
  const watchPathKey = (file: string): string => {
    const absolute = path.resolve(file);
    if (process.platform !== "win32" && process.platform !== "darwin") {
      return absolute;
    }
    let current = path.dirname(absolute);
    const traversed: string[] = [];
    let sensitive: boolean | undefined;
    for (;;) {
      const cacheKey =
        process.platform === "win32" ? current.toLowerCase() : current;
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

  const recordChange = (file: string): void => {
    changeSequence += 1;
    const absolute = path.resolve(file);
    const key = watchPathKey(absolute);
    componentLinks.delete(key);
    missingComponents.delete(key);
    changes.set(key, changeSequence);
    changes.set(watchPathKey(path.dirname(absolute)), changeSequence);
    if (changes.size > MAX_CHANGE_HISTORY) {
      changes.clear();
      historyFloor = changeSequence;
    }
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
    updatePoller();
    if (server !== undefined && importers.size !== 0) {
      invalidateImporters(server, importers);
      sendFullReload(server);
    }
  };

  const enqueue = (eventType: string, file: string): void => {
    const absolute = path.resolve(file);
    recordChange(absolute);
    for (const candidate of [absolute, path.dirname(absolute)]) {
      for (const entry of aliases.get(watchPathKey(candidate)) ?? []) {
        entry.changedAt = changeSequence;
        pending.add(entry);
      }
    }
    if (eventType === "rename") {
      const exact = renameAliases.get(watchPathKey(absolute));
      // Linux may report only the destination spelling of a directory rename.
      // That spelling cannot be indexed before the move. Fall back to the
      // renamed entry's parent only when no exact old spelling matched; the
      // baseline check below still invalidates solely inputs that really moved.
      const selected =
        exact !== undefined && exact.size !== 0
          ? exact
          : (renameAliases.get(watchPathKey(path.dirname(absolute))) ?? []);
      for (const entry of selected) {
        entry.changedAt = changeSequence;
        pending.add(entry);
      }
    }
    if (pending.size === 0 || flushTimer !== undefined) return;
    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      const selected = [...pending];
      pending.clear();
      check(selected);
    }, 0);
    flushTimer.unref();
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
        entries: new Set(),
        failed: false,
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
            owned.failed = true;
            try {
              owned.watcher?.close();
            } catch {
              // The fallback owns validation now; a failed native handle is no
              // longer useful, and cleanup must not replace that recovery.
            }
            owned.watcher = undefined;
            for (const entry of owned.entries) requirePolling(entry);
            updatePoller();
          },
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
  ): boolean => {
    const scope = ensureScope(root, external);
    if (scope === undefined) return false;
    scope.entries.add(entry);
    entry.scopes.add(scope);
    return !scope.failed;
  };

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
    const needed = links.size !== 0 || polled.size !== 0;
    if (!needed) {
      poller?.close();
      poller = undefined;
      return;
    }
    if (poller !== undefined) return;
    poller = openPoller(() => {
      const selected = new Set<InputEntry>();
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
      if (!bindScope(root, entry, false)) requirePolling(entry);
    } else {
      const external = nearestExistingDirectory(entry.file);
      if (external === undefined || !bindScope(external, entry, true))
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
        if (root === undefined || !containsPath(root, target)) {
          const targetRoot = nearestExistingDirectory(target);
          if (targetRoot === undefined || !bindScope(targetRoot, entry, true))
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
        if (link.target === undefined) requirePolling(entry);
        else if (
          !containsPath(root, link.target) &&
          !bindScope(link.target, entry, true)
        )
          requirePolling(entry);
      }
    }
  };

  return {
    attach(next) {
      server = next;
      projectRoot = path.resolve(next.config?.root ?? process.cwd());
      ensureScope(projectRoot, false, true);
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
      // Retain the attached server across overlapping Vite restart containers.
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

/** Test a set without allocating a transient array on the registration path. */
function someSet<T>(
  values: ReadonlySet<T>,
  predicate: (value: T) => boolean,
): boolean {
  for (const value of values) if (predicate(value)) return true;
  return false;
}

function openWatchPoller(listener: () => void): { close(): void } {
  const timer = setInterval(listener, 500);
  timer.unref();
  return { close: () => clearInterval(timer) };
}

function openRecursiveWatch(
  root: string,
  listener: (eventType: string, file: string | null) => void,
  onError: () => void,
): { close(): void } {
  const watcher = fs.watch(
    root,
    { persistent: false, recursive: true },
    (eventType, file) =>
      listener(eventType, file === null ? null : String(file)),
  );
  watcher.on("error", onError);
  return { close: () => watcher.close() };
}

function containsPath(root: string, file: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function nearestExistingDirectory(file: string): string | undefined {
  let current = path.resolve(file);
  try {
    if (!fs.statSync(current).isDirectory()) current = path.dirname(current);
  } catch {
    current = path.dirname(current);
  }
  for (;;) {
    try {
      if (fs.statSync(current).isDirectory()) {
        return path.dirname(current) === current ? undefined : current;
      }
    } catch {
      // Keep climbing to the nearest directory a recursive watch can own.
    }
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function linkedComponents(
  file: string,
  root: string,
  cached: Map<string, string | null>,
  missing: Set<string>,
  keyOf: (file: string) => string,
): string[] {
  const relative = path.relative(root, file);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    return [];
  const output: string[] = [];
  let current = path.resolve(root);
  for (const component of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, component);
    const key = keyOf(current);
    if (missing.has(key)) break;
    const known = cached.get(key);
    if (known !== undefined) {
      if (known !== null) output.push(current);
      continue;
    }
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        cached.set(key, realpath(current) ?? current);
        output.push(current);
      } else {
        cached.set(key, null);
      }
    } catch {
      missing.add(key);
      break;
    }
  }
  return output;
}

function realpath(file: string): string | undefined {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return undefined;
  }
}

/** Whether writes can reach this input through an unobserved hardlink alias. */
function hasMultipleLinks(file: string): boolean {
  try {
    const stats = fs.statSync(file);
    return stats.isFile() && stats.nlink > 1;
  } catch {
    return false;
  }
}

function sameSpelling(left: string, right: string): boolean {
  return process.platform === "win32"
    ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
    : path.resolve(left) === path.resolve(right);
}

/**
 * Invalidate every module-graph node of the registered importers so the next
 * request retransforms them. Importers keep their original absolute spelling so
 * the module graph's exact-key lookup can hit; graph lookups still go through
 * {@link selectModulesByFile} because module-graph file keys are
 * slash-normalized and, on case-insensitive filesystems, may not match the
 * compiler's spelling byte for byte.
 */
function invalidateImporters(
  server: ViteDevServerLike,
  importers: ReadonlySet<string>,
): void {
  for (const graph of selectModuleGraphs(server)) {
    for (const importer of importers) {
      for (const node of selectModulesByFile(graph, importer)) {
        try {
          graph.invalidateModule?.(node);
        } catch {
          // A graph shape this structural view mispredicts must not crash the
          // poll; the full-reload below still forces a refetch, and the
          // transform cache's external-input hashes force the recompile.
        }
      }
    }
  }
}

/**
 * Enumerate the server's module graphs: one per environment under the
 * environment API (Vite 6+), otherwise the mixed module graph (Vite 5).
 */
function selectModuleGraphs(server: ViteDevServerLike): ViteModuleGraphLike[] {
  const graphs: ViteModuleGraphLike[] = [];
  for (const environment of Object.values(server.environments ?? {})) {
    if (environment?.moduleGraph !== undefined) {
      graphs.push(environment.moduleGraph);
    }
  }
  if (graphs.length === 0 && server.moduleGraph !== undefined) {
    graphs.push(server.moduleGraph);
  }
  return graphs;
}

/**
 * Look up the module nodes registered for one importer spelling: the fast
 * slash-normalized `getModulesByFile` lookup first, then an identity scan of
 * `fileToModulesMap` for spellings that differ only by separator or case.
 */
function selectModulesByFile(
  graph: ViteModuleGraphLike,
  importer: string,
): ViteModuleNodeLike[] {
  const direct = graph.getModulesByFile?.(importer.replace(/\\/g, "/"));
  if (direct !== undefined && direct.size !== 0) {
    return [...direct];
  }
  const identity = pathIdentityKey(importer);
  const output: ViteModuleNodeLike[] = [];
  for (const [file, nodes] of graph.fileToModulesMap ?? []) {
    if (typeof file === "string" && pathIdentityKey(file) === identity) {
      output.push(...nodes);
    }
  }
  return output;
}

/**
 * Deliver one full-reload so connected clients refetch the invalidated
 * importers. The channels differ across Vite majors (`ws`, deprecated `hot`,
 * per-environment `hot`); the first one that accepts the payload wins.
 */
function sendFullReload(server: ViteDevServerLike): void {
  for (const channel of [
    server.ws,
    server.hot,
    server.environments?.client?.hot,
  ]) {
    if (channel?.send === undefined) {
      continue;
    }
    try {
      channel.send({ path: "*", type: "full-reload" });
      return;
    } catch {
      // Try the next channel; an unsupported payload on one major must not
      // suppress delivery through another.
    }
  }
}
