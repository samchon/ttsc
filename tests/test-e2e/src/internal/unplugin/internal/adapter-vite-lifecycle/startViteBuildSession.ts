import fs from "node:fs";
import path from "node:path";

import { invokeVitePluginHook } from "../adapter-vite-serve/invokeVitePluginHook";
import { loadViteAdapterPlugin } from "../adapter-vite-serve/loadViteAdapterPlugin";
import { createCacheProject } from "../transform-project-cache/createCacheProject";
import { projectModules } from "../transform-project-cache/projectModules";

/**
 * One driven `vite build` session over a fixture project, watching or not.
 *
 * Rollup's watcher repeats a whole build phase per rebuild, so the real hook
 * order across two rebuilds is `buildStart -> buildEnd -> writeBundle ->
 * closeBundle -> buildStart -> ... -> closeWatcher`, with only `closeWatcher`
 * firing once. An ordinary build closes its bundle instead and never reaches
 * `closeWatcher` at all. Driving the hooks directly reproduces both orders
 * exactly while keeping the scenarios free of a live watcher that can outlive
 * the runner.
 */
export async function startViteBuildSession(watching: boolean): Promise<{
  close: () => Promise<void>;
  resolveAs: (watching: boolean) => void;
  deliver: (file: string) => Promise<unknown>;
  endPass: () => Promise<void>;
  modules: string[];
  projectCompiles: () => number;
  startPass: () => Promise<void>;
  unrelatedInput: string;
}> {
  const plugin = await loadViteAdapterPlugin();
  const project = createCacheProject({ fileCount: 4 });
  let lifecycle = {};
  const resolveAs = (nextWatching: boolean): void => {
    invokeVitePluginHook(
      plugin.configResolved,
      {},
      {
        // `build.watch` is the axis the disposal boundary turns on: `null` for
        // an ordinary build, an object under `--watch`. Modelling only one of
        // them is what made the non-watching regression invisible.
        build: { watch: nextWatching ? {} : null },
        command: "build",
        resolve: { alias: [] },
        server: {},
      },
    );
  };
  resolveAs(watching);
  return {
    resolveAs,
    close: async () => {
      await invokeVitePluginHook(plugin.closeWatcher, {});
    },
    deliver: async (file: string) =>
      invokeVitePluginHook(
        plugin.transform,
        { addWatchFile: () => undefined },
        fs.readFileSync(file, "utf8"),
        file,
      ),
    endPass: async () => {
      await invokeVitePluginHook(plugin.buildEnd, lifecycle);
    },
    modules: projectModules(project.root),
    projectCompiles: () =>
      fs.existsSync(project.runLog)
        ? fs.readFileSync(project.runLog, "utf8").length
        : 0,
    startPass: async () => {
      lifecycle = {};
      await invokeVitePluginHook(plugin.buildStart, lifecycle);
    },
    unrelatedInput: path.join(project.root, "plugin.cjs"),
  };
}
