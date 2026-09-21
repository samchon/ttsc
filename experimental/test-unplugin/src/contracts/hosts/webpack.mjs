import fs from "node:fs";
import path from "node:path";

import {
  adapter,
  deadline,
  eventQueue,
  eventually,
  failedOutput,
  settledOutput,
  writeRaceLoader,
  writeStripLoader,
} from "../common.mjs";

/**
 * A watching webpack or Rspack compiler on the fixture, opened on its broken
 * input.
 *
 * A loader after ttsc's pre-enforced one lands the `LATE_RACE_` edits, between
 * ttsc returning a module and the host recording the module's inputs, and the
 * loader after that strips the types ttsc leaves, which neither host compiles
 * itself. Normal loaders run from the last rule to the first.
 */
export async function openSession(name, project) {
  const bundler =
    name === "webpack"
      ? (await import("webpack")).default
      : (await import("@rspack/core")).rspack;
  const plugin = await adapter(name, project.options);
  const events = eventQueue();
  let starts = [];
  const compiler = bundler({
    context: project.root,
    mode: "development",
    devtool: false,
    entry: project.entry,
    output: { path: path.dirname(project.output), filename: "bundle.js" },
    module: {
      rules: [
        { test: /\.ts$/, type: "javascript/auto" },
        { test: /\.ts$/, use: [{ loader: writeStripLoader(project.root) }] },
        { test: /\.ts$/, use: [{ loader: writeRaceLoader(project.root) }] },
      ],
    },
    resolve: { extensions: [".ts", ".js"] },
    plugins: [
      plugin,
      {
        apply(compiler) {
          compiler.hooks.compile.tap("observe-build", () => {
            const waiting = starts;
            starts = [];
            for (const resolve of waiting) resolve();
          });
        },
      },
    ],
  });
  const watcher = compiler.watch({}, (error, stats) => {
    if (error || stats?.hasErrors())
      events.push(error ?? new Error(stats.toString({ errors: true })));
    else events.push(fs.readFileSync(project.output, "utf8"));
  });
  return {
    name,
    exactRuns: true,
    lateRace: true,
    membership: true,
    settled: (label, value) => settledOutput(events, `${name} ${label}`, value),
    failed: (label, pattern) =>
      failedOutput(events, `${name} ${label}`, pattern),
    buildStarted: () =>
      new Promise((resolve) => {
        starts.push(resolve);
      }),
    async rebuild(value) {
      watcher.invalidate();
      await settledOutput(events, `${name} unchanged rebuild`, value);
    },
    recompiled: (label, before) =>
      eventually(
        () => project.runs(),
        (runs) => runs > before,
        `${name} ${label}`,
      ),
    close: async () => {
      await deadline(
        new Promise((resolve, reject) =>
          watcher.close((error) => (error ? reject(error) : resolve())),
        ),
        `${name} watcher close`,
      );
      await deadline(
        new Promise((resolve, reject) =>
          compiler.close((error) => (error ? reject(error) : resolve())),
        ),
        `${name} compiler close`,
      );
    },
  };
}
