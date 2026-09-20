import assert from "node:assert/strict";
import path from "node:path";

import { eventually, expectOutput, fixture, write } from "./common.mjs";

/** The original framework guard must accept an erased .server type import. */
export async function reactRouterContract() {
  const { createServer } = await import("vite");
  const project = fixture("react-router");
  write(
    project.root,
    "app/root.tsx",
    'import { Outlet } from "react-router"; export default function Root() { return <html><body><Outlet /></body></html>; }',
  );
  write(
    project.root,
    "app/entry.server.tsx",
    'import { renderToString } from "react-dom/server"; import { ServerRouter } from "react-router"; export default function handleRequest(request, status, headers, context) { headers.set("Content-Type", "text/html"); return new Response("<!DOCTYPE html>" + renderToString(<ServerRouter context={context} url={request.url} />), { status, headers }); }',
  );
  write(
    project.root,
    "app/routes.ts",
    'import { index } from "@react-router/dev/routes"; export default [index("routes/home.tsx")];',
  );
  write(
    project.root,
    "app/routes/home.tsx",
    'import type { ContractInput } from "../../src/contract-input.server"; export default function Home() { const value: ContractInput = watchValue(); return <p>{value}</p>; }',
  );
  write(
    project.root,
    "vite.config.mjs",
    [
      'import ttsc from "@ttsc/unplugin/vite";',
      'import { reactRouter } from "@react-router/dev/vite";',
      `export default { plugins: [ttsc(${JSON.stringify(project.options)}), reactRouter()] };`,
    ].join("\n"),
  );
  const before = process.cwd();
  process.chdir(project.root);
  let server;
  try {
    server = await createServer({
      root: project.root,
      configFile: path.join(project.root, "vite.config.mjs"),
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true },
      server: { middlewareMode: true, hmr: false },
    });
    const url = "/app/routes/home.tsx";
    expectOutput((await server.transformRequest(url)).code, "FIRST");
    const node =
      await server.environments.client.moduleGraph.getModuleByUrl(url);
    project.change("SECOND");
    await eventually(
      () => !node.transformResult,
      Boolean,
      "React Router dependency invalidation",
    );
    expectOutput((await server.transformRequest(url)).code, "SECOND");
    assert.ok(
      [...node.importedModules].every(
        (entry) => !entry.id.includes("contract-input.server"),
      ),
    );
    project.break();
    await eventually(
      () => !node.transformResult,
      Boolean,
      "React Router failed-input invalidation",
    );
    await assert.rejects(server.transformRequest(url), /invalid contract type/);
    project.change("THIRD");
    expectOutput((await server.transformRequest(url)).code, "THIRD");
  } finally {
    await server?.close();
    process.chdir(before);
  }
}
