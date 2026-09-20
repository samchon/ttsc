import assert from "node:assert/strict";

import {
  adapter,
  deadline,
  eventually,
  landLateRace,
  valuesIn,
} from "../common.mjs";

/**
 * A Vite dev server on the fixture, opened on its broken input, read through
 * `transformRequest` for each of the four modules in both environments.
 *
 * A plugin after ttsc lands the `LATE_RACE_` edits in its `transform` hook. The
 * server's own watcher hears the modules; the adapter's serve watcher hears the
 * compiler inputs and invalidates the importers, so a request after an edit
 * re-transforms them. A compiler-only input must never enter the runtime
 * resolver.
 */
export async function openSession(name, project) {
  const { createServer } = await import(name === "vite7" ? "vite" : "vite8");
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
      {
        name: "race-after-ttsc",
        transform(code) {
          landLateRace(project.root, code);
          return null;
        },
      },
    ],
    server: { middlewareMode: true, hmr: false },
  });
  await deadline(watcherReady, `${name} watcher ready`);
  const urls = ["main", "mod1", "mod2", "mod3"].map(
    (name) => `/src/${name}.ts`,
  );
  const request = async () => {
    const values = [];
    for (const ssr of [false, true])
      for (const url of urls)
        values.push(
          ...valuesIn((await server.transformRequest(url, { ssr })).code),
        );
    return values;
  };
  const converged = (value) => (values) =>
    values.length === 8 && values.every((found) => found === value);
  return {
    name,
    exactRuns: true,
    lateRace: true,
    membership: true,
    settled: (label, value) =>
      eventually(request, converged(value), `${name} ${label}`),
    failed: (label, pattern) =>
      eventually(
        () =>
          request().then(
            () => undefined,
            (error) => error,
          ),
        (error) => error instanceof Error && pattern.test(error.message),
        `${name} ${label}`,
      ),
    recompiled: (label, before) =>
      eventually(
        async () => {
          await request().catch(() => undefined);
          return project.runs();
        },
        (runs) => runs > before,
        `${name} ${label}`,
      ),
    async close() {
      assert.equal(resolutions, 0, "no compiler-only input was resolved");
      await server.close();
    },
    server,
    urls,
  };
}
