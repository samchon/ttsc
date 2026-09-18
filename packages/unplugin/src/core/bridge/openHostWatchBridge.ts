import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ViteModuleNodeLike } from "../vite/ViteModuleNodeLike";
import type { ViteServeWatchOperations } from "../vite/ViteServeWatchOperations";
import { createViteServeInputWatch } from "../vite/createViteServeInputWatch";
import type { HostWatchBridge } from "./HostWatchBridge";

/**
 * Open the watch bridge for one watching build session (samchon/ttsc#1388).
 *
 * Rolldown's and Farm's `addWatchFile` never report a created path or a
 * directory gaining an entry, so a missing declaration that appears, or a new
 * `@types` package, never rebuilt a watching session. Rollup reports both but
 * opens one chokidar instance per registered path, and recursively for a
 * directory, so its watcher count followed the compiler's input count. The
 * bridge observes every compiler input with the bounded observer that serves
 * the Vite dev server: one project scope plus at most 16 external ones, and a
 * precise predicate re-check per event. It then tells the host by rewriting one
 * sentinel per importer, the only path the host itself watches for it.
 *
 * The observer is reused through its structural server view: each importer is
 * its own module node, and invalidating that node rewrites the importer's
 * sentinel. Sentinels live in an owned directory below the system temp
 * directory, outside the project and any `node_modules`, which Farm's watcher
 * requires of an extra watch file.
 *
 * @param root The directory whose pinned scope observes the project.
 * @param operations Native watch seams, replaceable for tests.
 */
export function openHostWatchBridge(
  root: string,
  operations: Partial<ViteServeWatchOperations> = {},
): HostWatchBridge {
  const watch = createViteServeInputWatch(operations);
  const nodes = new Map<string, ViteModuleNodeLike & { file: string }>();
  let directory: string | undefined;
  let generation = 0;
  // Farm's dev server exposes no teardown hook, so the sentinel directory is
  // also removed when the process exits.
  const removeDirectory = (): void => {
    if (directory === undefined) return;
    fs.rmSync(directory, { force: true, recursive: true });
    directory = undefined;
  };
  const sentinelOf = (importer: string): string => {
    if (directory === undefined) {
      directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-watch-bridge-"));
      process.once("exit", removeDirectory);
    }
    const name = crypto.createHash("sha256").update(importer).digest("hex");
    return path.join(directory, `${name.slice(0, 32)}.signal`);
  };
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (file) => {
        const node = nodes.get(file);
        return node === undefined ? undefined : new Set([node]);
      },
      invalidateModule: (node) => {
        const importer = (node as { file?: string }).file;
        if (importer === undefined) return;
        generation += 1;
        try {
          fs.writeFileSync(sentinelOf(importer), String(generation));
        } catch {
          // A sentinel that cannot be written signals nothing. The host's
          // next pass still re-proves the generation against the filesystem.
        }
      },
    },
  });
  return {
    begin: () => watch.begin(),
    close: async () => {
      await watch.dispose();
      nodes.clear();
      process.off("exit", removeDirectory);
      removeDirectory();
    },
    register(importer, inputs, failed, startedAt) {
      nodes.set(importer.replace(/\\/g, "/"), { file: importer });
      watch.replace(importer, inputs, failed, startedAt);
      // A failed delivery keeps the importer's earlier inputs observed.
      if (inputs.length === 0 && failed !== true) return undefined;
      const sentinel = sentinelOf(importer);
      if (!fs.existsSync(sentinel)) fs.writeFileSync(sentinel, "0");
      return sentinel;
    },
  };
}
