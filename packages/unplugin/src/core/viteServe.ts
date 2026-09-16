import { watch, type FSWatcher } from "chokidar";
import fs from "node:fs";
import path from "node:path";

import {
  captureWatchInputBaseline,
  pathIdentityKey,
  validateGraphInputObservation,
  watchInputEvidenceMatchesBaseline,
  type TtscWatchInput,
  type TtscWatchInputBaseline,
  type TtscWatchInputEvidence,
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
  conditions: Map<string, InputCondition>;
  file: string;
  /** Missing paths and directory predicates still need the predicate poll. */
  poll: boolean;
  observed: boolean;
  links: Set<string>;
}

interface LinkedPath {
  target: string | undefined;
  inputs: Set<InputEntry>;
}

/** Serve-time compiler dependencies never enter Vite's runtime import graph. */
export interface ViteServeInputWatch {
  attach(server: ViteDevServerLike): void;
  dispose(): Promise<void>;
  replace(importer: string, inputs: readonly TtscWatchInput[], failed?: boolean): void;
}

/**
 * One filesystem subscription per unique input, shared by all served modules.
 *
 * Vite resolves transform-context addWatchFile as a runtime import, including
 * type-only .server files and non-module plugin assets. Use a separate watcher
 * for compiler inputs, including node_modules, which Vite's watcher ignores.
 * Ordinary files use events after their initial subscription is observed.
 * Missing spellings and directory predicates keep a shared predicate poll.
 * Linked files also share topology checks by directory because retargeting a
 * junction need not emit events on its previously watched descendants.
 */
export function createViteServeInputWatch(): ViteServeInputWatch {
  const entries = new Map<string, InputEntry>();
  const importerInputs = new Map<string, Map<string, string>>();
  const pending = new Set<InputEntry>();
  const links = new Map<string, LinkedPath>();
  let server: ViteDevServerLike | undefined;
  let watcher: FSWatcher | undefined;
  let poller: NodeJS.Timeout | undefined;
  let flushTimer: NodeJS.Timeout | undefined;
  let failed = false;

  const remove = (entry: InputEntry): void => {
    entries.delete(entry.file);
    watcher?.unwatch(entry.file);
    for (const file of entry.links) {
      const link = links.get(file);
      link?.inputs.delete(entry);
      if (link?.inputs.size === 0) links.delete(file);
    }
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
          changed = validateGraphInputObservation(entry.file, state.observation).length !== 0;
        } else {
          baseline ??= captureWatchInputBaseline(entry.file);
          changed = baseline === undefined || (condition.evidence?.state !== undefined
            ? !watchInputEvidenceMatchesBaseline(condition.evidence, baseline)
            : JSON.stringify(condition.baseline) !== JSON.stringify(baseline));
        }
        if (!changed) continue;
        for (const importer of condition.importers) importers.add(importer);
        entry.conditions.delete(key);
      }
      if (entry.conditions.size === 0) {
        remove(entry);
      }
    }
    if (server !== undefined && importers.size !== 0) {
      invalidateImporters(server, importers);
      sendFullReload(server);
    }
  };

  const enqueue = (file: string, observed: boolean): void => {
    const absolute = path.resolve(file);
    const direct = entries.get(absolute);
    if (direct !== undefined && observed) direct.observed = true;
    for (const candidate of [absolute, path.dirname(absolute)]) {
      const entry = entries.get(candidate);
      if (entry !== undefined) pending.add(entry);
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

  const ensureWatcher = (): FSWatcher => {
    if (watcher !== undefined) return watcher;
    const active = watch([], { depth: 0, ignoreInitial: false, persistent: false });
    watcher = active;
    // Initial add events compare compiler-time evidence too: an edit between
    // compilation and asynchronous watcher setup must not be missed.
    active.on("all", (event, file) => {
      if (watcher === active) enqueue(file, event === "add" || event === "addDir");
    });
    active.on("error", () => { if (watcher === active) failed = true; });
    poller = setInterval(() => {
      const selected = new Set([...entries.values()].filter((entry) => failed || entry.poll || !entry.observed));
      // Files reached through one linked directory share one topology check.
      // Content edits remain event-driven; retargeting a junction does not
      // reliably emit an event on its previously watched descendants.
      for (const [file, link] of links) {
        const target = realpath(file);
        if (target !== link.target) {
          link.target = target;
          for (const entry of link.inputs) {
            selected.add(entry);
            entry.observed = false;
            active.unwatch(entry.file);
            active.add(entry.file);
          }
        }
      }
      check(selected);
    }, 500);
    poller.unref();
    return watcher;
  };

  return {
    attach(next) { server = next; },
    async dispose() {
      entries.clear();
      importerInputs.clear();
      pending.clear();
      links.clear();
      if (poller !== undefined) clearInterval(poller);
      if (flushTimer !== undefined) clearTimeout(flushTimer);
      poller = undefined;
      flushTimer = undefined;
      const closing = watcher;
      watcher = undefined;
      failed = false;
      await closing?.close();
      // Retain the attached server across overlapping Vite restart containers.
    },
    replace(importer, inputs, failed = false) {
      if (server === undefined) return;
      importer = path.resolve(importer);
      const previous = importerInputs.get(importer) ?? new Map<string, string>();
      if (failed) {
        // An exception can omit the dependency whose deletion caused it.
        // Keep the last successful spellings until a successful delivery can
        // replace them, observing their current failed state for recovery.
        const reported = new Set(inputs.map((input) => path.resolve(input.file)));
        inputs = [...inputs, ...[...previous.keys()].filter((file) => !reported.has(file)).map((file) => ({ file }))];
      }
      const current = new Map<string, string>();
      const added: string[] = [];
      for (const input of inputs) {
        const file = path.resolve(input.file);
        const evidence = input.evidence;
        const key = JSON.stringify(evidence ?? null);
        current.set(file, key);
        let entry = entries.get(file);
        if (entry === undefined) {
          entry = { file, conditions: new Map(), poll: false, observed: false, links: new Set() };
          entries.set(file, entry);
          added.push(file);
          const directory = path.dirname(file);
          const directoryTarget = realpath(directory);
          const fileTarget = realpath(file);
          const linked = [
            ...(directoryTarget !== undefined && !sameSpelling(directory, directoryTarget) ? [directory] : []),
            ...(fileTarget !== undefined && directoryTarget !== undefined &&
              !sameSpelling(fileTarget, path.join(directoryTarget, path.basename(file))) ? [file] : []),
          ];
          for (const linkedFile of linked) {
            let link = links.get(linkedFile);
            if (link === undefined) {
              link = { target: realpath(linkedFile), inputs: new Set() };
              links.set(linkedFile, link);
            }
            link.inputs.add(entry);
            entry.links.add(linkedFile);
          }
        }
        let condition = entry.conditions.get(key);
        if (condition === undefined) {
          condition = {
            evidence,
            baseline: evidence?.state === undefined ? captureWatchInputBaseline(file) : undefined,
            importers: new Set(),
          };
          entry.conditions.set(key, condition);
        }
        condition.importers.add(importer);
        const observation = evidence?.state?.codec === "predicates"
          ? evidence.state.observation : undefined;
        entry.poll ||= evidence?.missing === true || evidence?.unavailable !== undefined ||
          (observation !== undefined && observation.fileExists !== true &&
            observation.stat !== "file" && observation.readFile?.ok !== true) ||
          (evidence?.state === undefined && condition.baseline?.fileExists !== true);
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
      importerInputs.set(importer, current);
      if (added.length !== 0) ensureWatcher().add(added);
    },
  };
}

function realpath(file: string): string | undefined {
  try { return fs.realpathSync.native(file); } catch { return undefined; }
}

function sameSpelling(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
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
