import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  adapter,
  eventually,
  expectOutput,
  landLateRace,
  valuesIn,
} from "../common.mjs";

/**
 * A Farm development compiler on the fixture, driven the way Farm's dev server
 * drives it: the server's watcher reports a changed path to `Compiler.update`,
 * and the contract reports the paths it changed and the sentinels the bridge
 * rewrote. Farm's public `Compiler` has no watcher of its own, so the session
 * opens on the broken input by compiling once and reading the failure.
 *
 * A plugin after ttsc lands the `LATE_RACE_` edits in its `transform` hook.
 */
export async function openSession(project) {
  const farm = await import("@farmfe/core");
  const logger = new farm.Logger({ exit: false });
  // A Farm compiler is created the way `farm start` creates one, from a
  // config resolved with a fresh plugin instance. Farm's `compile()` leaves a
  // compiler that failed in its compiling state for good, and `farm start`
  // fails outright on an initial compile error, so the session's repair of
  // the initial failure is what a user does: start Farm again.
  const create = async () => {
    const resolved = await farm.resolveConfig(
      {
        root: project.root,
        configFile: false,
        compilation: {
          input: { main: "./src/main.ts" },
          output: { path: "./dist-contract", targetEnv: "node", format: "esm" },
          minify: false,
          persistentCache: false,
          lazyCompilation: false,
          progress: false,
        },
        plugins: [
          await adapter("farm", project.options),
          {
            name: "race-after-ttsc",
            priority: -1,
            transform: {
              filters: { resolvedPaths: ["\\.ts$"] },
              executor(param) {
                landLateRace(project.root, param.content);
                return null;
              },
            },
          },
        ],
      },
      "development",
      logger,
    );
    return farm.createCompiler(resolved, logger);
  };
  let compiler = await create();
  let initial;
  try {
    await compiler.compile();
  } catch (error) {
    initial = error;
  }
  const read = (file) => {
    try {
      return fs.readFileSync(file, "utf8");
    } catch {
      return undefined;
    }
  };
  // What Farm's own file watcher would report: every path the compiler
  // resolved to watch, the bridge's sentinels among them, whose content
  // differs from what was seen last.
  const seen = new Map();
  const watchedPaths = () =>
    compiler
      .resolvedWatchPaths()
      .map((entry) => path.resolve(project.root, entry));
  const observe = () => {
    for (const file of watchedPaths()) {
      if (!seen.has(file)) seen.set(file, read(file));
    }
  };
  const changedWatched = () => {
    observe();
    const changed = [];
    for (const [file, before] of seen) {
      const now = read(file);
      if (now !== before) {
        seen.set(file, now);
        changed.push(file);
      }
    }
    return changed;
  };
  const output = () =>
    Object.values(compiler.resources())
      .map((value) => value.toString())
      .join("\n");
  const update = async (files) => {
    if (files.length === 0) return output();
    const updated = await compiler.update(files);
    return [updated.mutableModules, updated.immutableModules].join("\n");
  };
  let firstCompile = true;
  return {
    name: "farm",
    exactRuns: true,
    lateRace: true,
    membership: true,
    async settled(label, value, changed) {
      let code;
      if (firstCompile) {
        // The session's first compile failed on the broken input; Farm's own
        // recovery is a restart.
        firstCompile = false;
        compiler = await create();
        await compiler.compile();
        code = output();
      } else {
        observe();
        for (const file of changed) seen.set(file, read(file));
        code = await update(changed);
      }
      // The bridge answers an edit the compile did not read by rewriting the
      // importer's sentinel, which the dev server's watcher reports next.
      await eventually(
        async () => {
          const values = valuesIn(code);
          if (values.length === 4 && values.every((found) => found === value))
            return values;
          const signalled = changedWatched();
          if (signalled.length !== 0) code = await update(signalled);
          return valuesIn(code);
        },
        (values) =>
          values.length === 4 && values.every((found) => found === value),
        `farm ${label}`,
      );
    },
    async failed(label, pattern, changed) {
      if (changed === undefined) {
        assert.ok(initial, `farm ${label}: the first compile fails`);
        assert.match(String(initial.message ?? initial), pattern);
        return;
      }
      observe();
      for (const file of changed) seen.set(file, read(file));
      // Farm reports a failed update by rejecting it, or, for a failure
      // inside its update callback, as an unhandled rejection its dev server
      // logs; the session takes either as the failure.
      const attempt = (files) => {
        let unhandled;
        return new Promise((resolve) => {
          unhandled = (error) => resolve(error);
          process.once("unhandledRejection", unhandled);
          update(files).then(
            () => resolve(undefined),
            (error) => resolve(error),
          );
          setTimeout(() => resolve(undefined), 30_000).unref();
        }).finally(() => process.off("unhandledRejection", unhandled));
      };
      // A change to a file Farm holds no module for reaches it through the
      // importer's sentinel, which the dev server's watcher reports next.
      let failure = await attempt(changed);
      await eventually(
        async () => {
          if (failure !== undefined) return failure;
          const signalled = changedWatched();
          if (signalled.length !== 0) failure = await attempt(signalled);
          return failure;
        },
        (found) =>
          found !== undefined && pattern.test(String(found.message ?? found)),
        `farm ${label}`,
      );
    },
    async rebuild(value) {
      observe();
      expectOutput(await update([project.input]), value, 4);
    },
    recompiled: (label, before) =>
      eventually(
        async () => {
          const signalled = changedWatched();
          if (signalled.length !== 0) await update(signalled);
          return project.runs();
        },
        (runs) => runs > before,
        `farm ${label}`,
      ),
    // Farm's Compiler API has no close/dispose method; the process owns it.
    close: () => undefined,
  };
}
