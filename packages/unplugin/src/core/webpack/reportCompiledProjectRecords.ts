import path from "node:path";

import type { HostWatchBridge } from "../bridge/HostWatchBridge";

/**
 * Tell a watching webpack or Rspack compiler's bridge which project records the
 * compile that just ended depends on (`HostWatchBridge.compiled`), read from
 * the compilation's own file dependencies.
 *
 * Those dependencies are what the compiler's watcher observes until its next
 * compile, and they name every file a module depends on whether the compile
 * built the module or restored it from the cache, so a project's record is
 * among them exactly while the compiler holds a module of the project. webpack
 * and Rspack run one compiler per target, Next's client, server and edge among
 * them, each with a bridge of its own that takes every record of the tool
 * directory at its first pass: the edge compiler holds no module of the page's
 * project, and its bridge would otherwise move that record on the growing
 * schedule for the rest of the session, each move running the client and server
 * compilers again. A compiler that builds a module on demand, as `next dev`
 * builds a page on its first request, depends on the record only from that
 * compile on, and its bridge observes the record meanwhile.
 *
 * @param bridge The session's bridge, when one is open.
 * @param dependencies The ended compilation's `fileDependencies`: a set of
 *   absolute paths, or any iterable of them.
 */
export function reportCompiledProjectRecords(
  bridge: HostWatchBridge | undefined,
  dependencies: Iterable<string> & { has?(file: string): boolean },
): void {
  if (bridge === undefined) return;
  const depends =
    typeof dependencies.has === "function"
      ? (file: string) => dependencies.has!(file)
      : (() => {
          const files = new Set(dependencies);
          return (file: string) => files.has(file);
        })();
  bridge.compiled((record) => depends(record) || depends(path.resolve(record)));
}
