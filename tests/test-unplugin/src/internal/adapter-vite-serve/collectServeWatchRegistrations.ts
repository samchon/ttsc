import fs from "node:fs";

import type { IViteServeCandidateFixture } from "./IViteServeCandidateFixture";
import { invokeVitePluginHook } from "./invokeVitePluginHook";
import { loadViteAdapterPlugin } from "./loadViteAdapterPlugin";

/** Check the watcherless registration branch through the adapter's public hooks. */
export async function collectServeWatchRegistrations(
  fixture: IViteServeCandidateFixture,
  options: { watching: boolean },
): Promise<string[]> {
  const plugin = await loadViteAdapterPlugin();
  const invoke = invokeVitePluginHook;
  const lifecycle = {};
  invoke(
    plugin.configResolved,
    {},
    {
      command: "serve",
      resolve: { alias: [] },
      server: options.watching ? { watch: {} } : { watch: null },
    },
  );
  await invoke(plugin.buildStart, lifecycle);
  const watched: string[] = [];
  try {
    await invoke(
      plugin.transform,
      { addWatchFile: (file: string) => watched.push(file) },
      fs.readFileSync(fixture.mainFile, "utf8"),
      fixture.mainFile,
    );
    return watched;
  } finally {
    await invoke(plugin.buildEnd, lifecycle);
  }
}
