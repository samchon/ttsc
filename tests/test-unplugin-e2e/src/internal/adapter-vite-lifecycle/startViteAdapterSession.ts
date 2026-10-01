import fs from "node:fs";
import path from "node:path";

import { invokeVitePluginHook } from "../adapter-vite-serve/invokeVitePluginHook";
import { loadViteAdapterPlugin } from "../adapter-vite-serve/loadViteAdapterPlugin";
import { settleFilesystemNotifications } from "../filesystem-notifications/settleFilesystemNotifications";
import { createCacheProject } from "../transform-project-cache/createCacheProject";
import { projectModules } from "../transform-project-cache/projectModules";
import type { IViteAdapterSession } from "./IViteAdapterSession";

/**
 * Start a Vite adapter session over a fresh fixture project.
 *
 * `watching` selects the two configurations the lifecycle decision separates: a
 * dev server with a live watcher, and one configured with `server.watch: null`,
 * which is what a one-shot consumer (`vitest --run` above all) resolves to.
 */
export async function startViteAdapterSession(options: {
  fileCount?: number;
  watching: boolean;
}): Promise<IViteAdapterSession> {
  const plugin = await loadViteAdapterPlugin();
  const lifecycle = {};
  const project = createCacheProject({ fileCount: options.fileCount ?? 4 });
  await settleFilesystemNotifications();
  invokeVitePluginHook(
    plugin.configResolved,
    {},
    {
      command: "serve",
      resolve: { alias: [] },
      server: options.watching ? { watch: {} } : { watch: null },
    },
  );
  await invokeVitePluginHook(plugin.buildStart, lifecycle);
  return {
    close: async () => {
      await invokeVitePluginHook(plugin.buildEnd, lifecycle);
    },
    deliver: async (file: string) =>
      invokeVitePluginHook(
        plugin.transform,
        { addWatchFile: () => undefined },
        fs.readFileSync(file, "utf8"),
        file,
      ),
    modules: projectModules(project.root),
    projectCompiles: () =>
      fs.existsSync(project.runLog)
        ? fs.readFileSync(project.runLog, "utf8").length
        : 0,
    unrelatedInput: path.join(project.root, "plugin.cjs"),
  };
}
