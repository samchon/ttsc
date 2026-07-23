import fs from "node:fs";
import path from "node:path";

import { pathIdentityKey } from "./transform";

/**
 * How often each registered missing watch input is stat-polled, in
 * milliseconds.
 *
 * Polling is the only watch primitive that covers the whole class: the dev
 * server's chokidar watcher ignores every `node_modules` directory, which is
 * exactly where superseding resolution candidates usually live, and `fs.watch`
 * cannot observe a path whose parent directories do not exist yet. One `stat`
 * every half second per missing path is negligible against a dev server's
 * baseline.
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
 * Filesystem watch for derived watch inputs that do not exist while a Vite dev
 * server is running.
 *
 * Vite serve treats every transform-context `addWatchFile()` registration as an
 * added import: `TransformPluginContext.addWatchFile` stores the path in
 * `_addedImports`, and `vite:import-analysis` resolves each entry like a real
 * import of the transformed module. A missing path — a superseding resolution
 * candidate or a plugin-reported dependency that is not generated yet — then
 * fails that resolve and turns the importer's first request into a 500, even
 * though the transform itself succeeded.
 *
 * This registry is the serve-only replacement for those registrations. Each
 * missing path is stat-polled; when it is created, every importer that
 * registered it is invalidated in the server's module graphs and one
 * full-reload is sent, so the next request retransforms the importer against
 * the new resolution winner. The project transform cache re-validates through
 * its external-input hashes (a recorded `missing` marker differs from a content
 * hash), so the retransform recompiles instead of replaying.
 */
export interface ViteServeMissingInputWatch {
  /** Adopt the dev server whose module graphs creation events invalidate. */
  attach(server: ViteDevServerLike): void;
  /** Stop every poll and forget the server; safe to call repeatedly. */
  dispose(): void;
  /** Report whether a dev server is attached (i.e. Vite serve is running). */
  serving(): boolean;
  /** Register one missing watch input derived for `importer`. */
  watch(input: string, importer: string): void;
}

/** Poll bookkeeping for one registered missing path. */
interface IMissingInputEntry {
  importers: Set<string>;
  listener: (current: fs.Stats) => void;
  spelling: string;
}

/** Create an empty missing-input watch for one plugin instance. */
export function createViteServeMissingInputWatch(): ViteServeMissingInputWatch {
  const entries = new Map<string, IMissingInputEntry>();
  let server: ViteDevServerLike | undefined;

  const unwatch = (identity: string, entry: IMissingInputEntry): void => {
    fs.unwatchFile(entry.spelling, entry.listener);
    entries.delete(identity);
  };

  return {
    attach(next) {
      server = next;
    },
    dispose() {
      for (const [identity, entry] of entries) {
        unwatch(identity, entry);
      }
      server = undefined;
    },
    serving() {
      return server !== undefined;
    },
    watch(input, importer) {
      const spelling = path.resolve(input);
      const identity = pathIdentityKey(spelling);
      const existing = entries.get(identity);
      if (existing !== undefined) {
        existing.importers.add(pathIdentityKey(importer));
        return;
      }
      const entry: IMissingInputEntry = {
        importers: new Set([pathIdentityKey(importer)]),
        listener: (current) => {
          // `fs.watchFile` reports a missing path as zeroed stats (and fires
          // once with them right after registration); only a poll that
          // observes a real file is a creation event.
          if (current.mtimeMs === 0 && !fs.existsSync(entry.spelling)) {
            return;
          }
          unwatch(identity, entry);
          if (server === undefined) {
            return;
          }
          invalidateImporters(server, entry.importers);
          sendFullReload(server);
        },
        spelling,
      };
      entries.set(identity, entry);
      const watcher = fs.watchFile(
        spelling,
        { interval: MISSING_INPUT_POLL_INTERVAL },
        entry.listener,
      );
      // A poller must never keep the dev-server process alive on its own.
      watcher.unref?.();
    },
  };
}

/**
 * Invalidate every module-graph node of the registered importers so the next
 * request retransforms them. Importer keys are filesystem identities (see
 * {@link pathIdentityKey}); graph lookups go through {@link selectModulesByFile}
 * because module-graph file keys are slash-normalized and, on case-insensitive
 * filesystems, may not match the compiler's spelling byte for byte.
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
 * Look up the module nodes registered for one importer identity: the fast
 * slash-normalized `getModulesByFile` lookup first, then an identity scan of
 * `fileToModulesMap` for spellings that differ only by separator or case.
 */
function selectModulesByFile(
  graph: ViteModuleGraphLike,
  importerIdentity: string,
): ViteModuleNodeLike[] {
  const direct = graph.getModulesByFile?.(importerIdentity.replace(/\\/g, "/"));
  if (direct !== undefined && direct.size !== 0) {
    return [...direct];
  }
  const output: ViteModuleNodeLike[] = [];
  for (const [file, nodes] of graph.fileToModulesMap ?? []) {
    if (
      typeof file === "string" &&
      pathIdentityKey(file) === importerIdentity
    ) {
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
