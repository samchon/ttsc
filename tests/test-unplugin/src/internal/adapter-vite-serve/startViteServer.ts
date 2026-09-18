import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import fs from "node:fs";

import type { IViteServeCandidateFixture } from "./IViteServeCandidateFixture";

const viteCreateServer: (config: object) => Promise<any> =
  TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite").createServer;

/** Start a real Vite dev server over the fixture with the ttsc adapter. */
export async function startViteServer(
  fixture: IViteServeCandidateFixture,
): Promise<any> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  // Vite 7 cannot load a URL beneath the 8.3 spelling Windows may return from
  // os.tmpdir(), even though Node can stat that alias. Give Vite the same long
  // physical root its resolver will put into the resolved module id.
  const viteRoot = fs.realpathSync.native(fixture.app);
  const server = await viteCreateServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    // Dependency discovery would race the scenario with esbuild prebundling
    // restarts; the linked package resolves as source without it.
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    root: viteRoot,
    // These scenarios exercise the real watching serve lifecycle. The private
    // compiler watcher owns node_modules and missing-resolution predicates.
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  return server;
}
