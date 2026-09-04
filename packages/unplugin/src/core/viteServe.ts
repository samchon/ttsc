import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { pathIdentityKey, validateGraphInputObservation } from "./transform";

/**
 * How often each registered Vite-unsafe input is predicate-polled, in
 * milliseconds.
 *
 * Polling is the only watch primitive that covers the whole class: the dev
 * server's chokidar watcher ignores every `node_modules` directory, which is
 * exactly where superseding resolution candidates usually live, and `fs.watch`
 * cannot observe a path whose parent directories do not exist yet. One `stat`
 * every half second per unavailable path is negligible against a dev server's
 * baseline. Rich inputs replay only the predicates the compiler recorded.
 */
const MISSING_INPUT_POLL_INTERVAL = 500;

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

/**
 * Filesystem watch for derived watch inputs that Vite cannot safely register as
 * added imports while a development server is running.
 *
 * Vite serve treats every transform-context `addWatchFile()` registration as an
 * added import: `TransformPluginContext.addWatchFile` stores the path in
 * `_addedImports`, and `vite:import-analysis` resolves each entry like a real
 * import of the transformed module. A missing path or an existing directory
 * that failed a compiler file predicate then fails that resolve and turns the
 * importer's first request into a 500, even though the transform succeeded.
 *
 * This registry is the serve-only replacement for those registrations. Each
 * path is polled until its exact compiler predicate observation changes; legacy
 * envelopes retain their exists-or-file availability check. Its importers are
 * then invalidated in the server's module graphs and one full-reload is sent,
 * so the next request retransforms against the new resolution winner. The
 * project transform cache re-validates the compiler observation, so the
 * retransform recompiles instead of replaying.
 */
export interface ViteServeMissingInputWatch {
  /** Adopt the dev server whose module graphs creation events invalidate. */
  attach(server: ViteDevServerLike): void;
  /** Stop every poll; safe to call repeatedly. */
  dispose(): void;
  /**
   * Report whether a dev server has ever been attached. This is not a liveness
   * predicate — the reference intentionally survives the server's close (see
   * {@link dispose}) — so route decisions must also gate on the resolved
   * config's `command`, as the adapter does.
   */
  serving(): boolean;
  /** Register one unsafe watch input and its exact recorded condition. */
  watch(
    input: string,
    importer: string,
    condition: ViteServeInputWatchCondition,
  ): void;
}

/** A legacy availability condition or an exact compiler predicate proof. */
export type ViteServeInputWatchCondition =
  | "exists"
  | "file"
  | ITtscCompilerTransformation.IInputObservation;

/** Poll bookkeeping for one registered unsafe path. */
interface IMissingInputEntry {
  condition: ViteServeInputWatchCondition;
  importers: Set<string>;
  spelling: string;
}

/** Create an empty missing-input watch for one plugin instance. */
export function createViteServeMissingInputWatch(): ViteServeMissingInputWatch {
  const entries = new Map<string, IMissingInputEntry>();
  let poller: NodeJS.Timeout | undefined;
  let server: ViteDevServerLike | undefined;

  const stopPollingIfEmpty = (): void => {
    if (entries.size !== 0 || poller === undefined) {
      return;
    }
    clearInterval(poller);
    poller = undefined;
  };
  const poll = (): void => {
    const importers = new Set<string>();
    for (const [identity, entry] of entries) {
      if (!viteServeInputWatchConditionChanged(entry)) {
        continue;
      }
      entries.delete(identity);
      for (const importer of entry.importers) {
        importers.add(importer);
      }
    }
    stopPollingIfEmpty();
    if (server === undefined || importers.size === 0) {
      return;
    }
    invalidateImporters(server, importers);
    sendFullReload(server);
  };

  return {
    attach(next) {
      server = next;
    },
    dispose() {
      entries.clear();
      if (poller !== undefined) {
        clearInterval(poller);
        poller = undefined;
      }
      // The server reference deliberately survives: `vite.restartServer`
      // configures the replacement server (attach) before it closes the old
      // one (whose buildEnd runs this dispose), so unsetting it here would
      // detach the freshly attached replacement and revive the 500 this
      // module exists to prevent. A same-instance `vite build` after a serve
      // is instead excluded by the adapter's `config.command` gate.
    },
    serving() {
      return server !== undefined;
    },
    watch(input, importer, condition) {
      const spelling = path.resolve(input);
      const identity = viteServeMissingInputWatchKey(spelling, condition);
      const existing = entries.get(identity);
      if (existing !== undefined) {
        existing.importers.add(path.resolve(importer));
        return;
      }
      entries.set(identity, {
        condition,
        importers: new Set([path.resolve(importer)]),
        spelling,
      });
      if (poller === undefined) {
        poller = setInterval(poll, MISSING_INPUT_POLL_INTERVAL);
        // A poller must never keep the dev-server process alive on its own.
        poller.unref?.();
      }
    },
  };
}

/** Key a private poll by predicate and exact lexical spelling. */
export function viteServeMissingInputWatchKey(
  input: string,
  condition: ViteServeInputWatchCondition,
): string {
  // Missing aliases can share a physical parent now and later retarget or
  // diverge. Neither predicate may let one lexical spelling answer for another.
  const predicate =
    typeof condition === "string"
      ? condition
      : `predicates:${JSON.stringify([
          condition.accessibleEntries === undefined
            ? null
            : [
                condition.accessibleEntries.directories,
                condition.accessibleEntries.files,
              ],
          condition.directoryExists ?? null,
          condition.fileExists ?? null,
          condition.readFile === undefined
            ? null
            : condition.readFile.ok
              ? [true, condition.readFile.hash]
              : [false],
          condition.realpath === undefined
            ? null
            : condition.realpath.ok
              ? [true, condition.realpath.path]
              : [false],
          condition.stat ?? null,
        ])}`;
  return `${predicate}:${path.resolve(input)}`;
}

/** Whether one registered condition no longer describes its lexical path. */
function viteServeInputWatchConditionChanged(
  entry: IMissingInputEntry,
): boolean {
  if (typeof entry.condition !== "string") {
    return (
      validateGraphInputObservation(entry.spelling, entry.condition).length !==
      0
    );
  }
  try {
    if (!fs.existsSync(entry.spelling)) {
      return false;
    }
    return (
      entry.condition === "exists" || !fs.statSync(entry.spelling).isDirectory()
    );
  } catch {
    return false;
  }
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
