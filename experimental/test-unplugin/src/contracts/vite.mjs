import assert from "node:assert/strict";
import path from "node:path";

import {
  adapter,
  deadline,
  eventually,
  expectOutput,
  fixture,
  write,
} from "./common.mjs";

export async function viteContract(name) {
  const { createServer } = await import(name === "vite7" ? "vite" : "vite8");
  const project = fixture(name);
  let resolutions = 0;
  let ready;
  const watcherReady = new Promise((resolve) => {
    ready = resolve;
  });
  const server = await createServer({
    root: project.root,
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    optimizeDeps: { noDiscovery: true },
    plugins: [
      await adapter("vite", project.options),
      {
        name: "observe-compiler-boundary",
        enforce: "pre",
        configureServer(server) {
          server.watcher.once("ready", ready);
        },
        resolveId(id) {
          if (id.includes("contract-input.server")) {
            resolutions++;
            throw new Error("Compiler-only input entered the runtime resolver");
          }
        },
      },
    ],
    server: { middlewareMode: true, hmr: false },
  });
  const urls = ["main", "mod1", "mod2", "mod3"].map(
    (name) => `/src/${name}.ts`,
  );
  const request = async (value, ssr = false) => {
    for (const url of urls)
      expectOutput((await server.transformRequest(url, { ssr })).code, value);
  };
  try {
    await deadline(watcherReady, `${name} watcher ready`);
    for (const ssr of [false, true]) await request("FIRST", ssr);
    assert.equal(project.runs(), 1);
    const nodes = await Promise.all(
      ["client", "ssr"].flatMap((environment) =>
        urls.map((url) =>
          server.environments[environment].moduleGraph.getModuleByUrl(url),
        ),
      ),
    );
    assert.ok(
      nodes.every((node) =>
        [...node.importedModules].every(
          (entry) => !entry.id.includes("contract-input.server"),
        ),
      ),
    );
    for (const value of ["SECOND", "THIRD"]) {
      project.change(value);
      await eventually(
        () => nodes.every((node) => node.transformResult === null),
        Boolean,
        `${name} invalidation before refetch`,
      );
      for (const ssr of [false, true]) await request(value, ssr);
    }
    assert.equal(project.runs(), 3);
    assert.equal(resolutions, 0);
    await server.restart();
    await request("THIRD");
    assert.equal(project.runs(), 4);
    const restarted = await Promise.all(
      urls.map((url) =>
        server.environments.client.moduleGraph.getModuleByUrl(url),
      ),
    );
    project.change("FOURTH");
    await eventually(
      () => restarted.every((node) => node.transformResult === null),
      Boolean,
      `${name} subscription after restart`,
    );
    await request("FOURTH");
    assert.equal(project.runs(), 5);
  } finally {
    await server.close();
  }
}

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
  } finally {
    await server?.close();
    process.chdir(before);
  }
}
