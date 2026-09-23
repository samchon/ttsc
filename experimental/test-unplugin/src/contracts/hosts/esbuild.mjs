import assert from "node:assert/strict";

import {
  adapter,
  eventQueue,
  eventually,
  expectOutput,
  failedOutput,
  landLateRace,
  settledOutput,
} from "../common.mjs";

/**
 * A watching esbuild context on the fixture, opened on its broken input.
 *
 * Esbuild offers no seam after a module's loader: the first `onLoad` to answer
 * owns the file. The seam after ttsc is therefore the resolution of the
 * module's own imports, which esbuild performs once the module's loader has
 * returned, while the build goes on; a `LATE_RACE_` edit lands there.
 *
 * Esbuild's watcher polls the paths each loader result names: each module and
 * the project's record, which the adapter's bridge moves for a file appearing
 * as for any other change, so the session offers root-file membership.
 */
export async function openSession(project) {
  const esbuild = await import("esbuild");
  const events = eventQueue();
  let starts = [];
  const context = await esbuild.context({
    absWorkingDir: project.root,
    entryPoints: [project.entry],
    bundle: true,
    write: false,
    format: "esm",
    logLevel: "silent",
    plugins: [
      await adapter("esbuild", project.options),
      {
        name: "observe-build",
        setup(build) {
          build.onStart(() => {
            const waiting = starts;
            starts = [];
            for (const resolve of waiting) resolve();
          });
          build.onResolve({ filter: /^\.\/mod\d\.ts$/ }, () => {
            landLateRace(project.root);
            return undefined;
          });
          build.onEnd((result) => {
            events.push(
              result.errors.length
                ? new Error(JSON.stringify(result.errors))
                : result.outputFiles[0].text,
            );
          });
        },
      },
    ],
  });
  await context.watch();
  return {
    name: "esbuild",
    exactRuns: true,
    lateRace: true,
    membership: true,
    settled: (label, value) => settledOutput(events, `esbuild ${label}`, value),
    failed: (label, pattern) =>
      failedOutput(events, `esbuild ${label}`, pattern),
    buildStarted: () =>
      new Promise((resolve) => {
        starts.push(resolve);
      }),
    async rebuild(value) {
      const result = await context.rebuild();
      assert.equal(result.errors.length, 0);
      expectOutput(result.outputFiles[0].text, value, 4);
      // The rebuild's own end reaches the queue as a build; consume it.
      await settledOutput(events, "esbuild unchanged rebuild", value);
    },
    recompiled: (label, before) =>
      eventually(
        () => project.runs(),
        (runs) => runs > before,
        `esbuild ${label}`,
      ),
    close: () => context.dispose(),
  };
}
