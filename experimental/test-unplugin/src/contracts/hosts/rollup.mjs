import assert from "node:assert/strict";
import fs from "node:fs";

import {
  BROKEN_INPUT,
  adapter,
  eventQueue,
  eventually,
  failedOutput,
  landLateRace,
  settledOutput,
  stripTypes,
} from "../common.mjs";

/**
 * A watching Rollup or Rolldown session on the fixture, opened on its broken
 * input.
 *
 * Rollup emits its first watch ERROR before Chokidar owns subscriptions, and an
 * immediate repair can be missed even by a plain native Rollup plugin, so the
 * initial error and dependency ownership are proven through `rollup()` first,
 * and the same plugin instance then serves the watcher.
 *
 * A plugin placed after ttsc lands the `LATE_RACE_` edits: the one place a
 * public API reaches between ttsc returning a module and the build ending. A
 * plugin after it strips the types ttsc leaves for Rollup, which compiles none
 * itself; Rolldown strips its own.
 */
export async function openSession(name, project) {
  const bundler = await import(name);
  const plugin = await adapter(name, project.options);
  if (name === "rollup") {
    await assert.rejects(
      bundler.rollup({ input: project.entry, plugins: [plugin] }),
      (error) => {
        assert.match(error.message, BROKEN_INPUT);
        assert.ok(error.watchFiles.includes(project.input));
        return true;
      },
    );
  }
  const events = eventQueue();
  let starts = [];
  const watcher = bundler.watch({
    input: project.entry,
    plugins: [
      plugin,
      {
        name: "race-after-ttsc",
        transform(code) {
          landLateRace(project.root, code);
          return null;
        },
      },
      ...(name === "rollup"
        ? [
            {
              name: "strip-types-after-ttsc",
              transform(code, id) {
                return id.endsWith(".ts")
                  ? { code: stripTypes(code), map: null }
                  : null;
              },
            },
          ]
        : []),
    ],
    output: { file: project.output, format: "esm" },
    watch: { clearScreen: false },
  });
  watcher.on("event", async (event) => {
    if (event.code === "BUNDLE_START") {
      const waiting = starts;
      starts = [];
      for (const resolve of waiting) resolve();
    }
    if (event.code === "ERROR") events.push(event.error);
    if (event.code === "BUNDLE_END") {
      try {
        const code = fs.readFileSync(project.output, "utf8");
        await event.result?.close();
        events.push(code);
      } catch (error) {
        events.push(error);
      }
    }
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
    recompiled: (label, before) =>
      eventually(
        () => project.runs(),
        (runs) => runs > before,
        `${name} ${label}`,
      ),
    close: () => watcher.close(),
  };
}
