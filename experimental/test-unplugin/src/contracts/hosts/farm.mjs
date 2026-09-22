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

/** The project record below the tool directory (`projectRecordFile`). */
const RECORD = /[\\/]records[\\/][0-9a-f]{32}\.json$/;

/**
 * A Farm development compiler on the fixture, driven the way Farm's dev server
 * drives it: the server's watcher reports a changed path to `Compiler.update`,
 * and the contract reports the paths it changed and the project record the
 * bridge moved. Farm's public `Compiler` has no watcher of its own, so the
 * session opens on the broken input by compiling once and reading the failure.
 *
 * A plugin after ttsc lands the `LATE_RACE_` edits in its `transform` hook.
 *
 * With `cache`, the compiler runs over Farm's persistent cache, stored beside
 * the project, and the session reports `stored()` once every store of that
 * cache committed after the session opened.
 */
export async function openSession(project, { cache = false } = {}) {
  const cacheDir = path.join(project.physical, ".cache", "farm");
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
          // Farm turns the timestamp cache-key strategy off for a Node
          // target, and under the hash strategy alone it runs every
          // module's load and transform before comparing, so a persistent
          // cache can only skip a compile for a browser target.
          output: {
            path: "./dist-contract",
            targetEnv: cache ? "browser" : "node",
            format: "esm",
          },
          minify: false,
          persistentCache: cache ? { cacheDir } : false,
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
  // resolved to watch, the project's record among them, whose content
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
  // What Farm's dev server updates for a path its watcher reports: one the
  // compiler holds a module for, a source module or a watch file a module
  // named, the project's record among them (`hmrEngine.hmrUpdate`). A path it
  // holds none for is dropped; the adapter's bridge moves the record for it,
  // which the watcher reports next (`changedWatched`).
  const update = async (files) => {
    const reported = files.filter((file) =>
      compiler.hasModule(path.resolve(file)),
    );
    if (reported.length === 0) return output();
    const updated = await compiler.update(reported);
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
        firstCompile = false;
        if (initial !== undefined) {
          // The session's first compile failed on the broken input; Farm's
          // own recovery is a restart. A compile that succeeded keeps its
          // compiler: a second one over the same persistent cache reads each
          // store's manifest while the first's write thread may be
          // rewriting it in place, and panics on the empty file (measured on
          // the Windows lane).
          compiler = await create();
          await compiler.compile();
        }
        code = output();
      } else {
        observe();
        for (const file of changed) seen.set(file, read(file));
        code = await update(changed);
      }
      // The bridge answers an edit the compile did not read by rewriting the
      // project's record, which the dev server's watcher reports next.
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
      // project's record, which the dev server's watcher reports next.
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
    // What Farm's watcher reports for an edit that changes nothing: the input
    // and the project's record every module watches, which the adapter left
    // as it was; every module then runs again from the unchanged generation.
    async rebuild(value) {
      observe();
      expectOutput(
        await update([
          project.input,
          ...watchedPaths().filter((file) => RECORD.test(file)),
        ]),
        value,
        4,
      );
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
    // No `builtAt`: Farm's compiler writes its cache inside the compile, so a
    // commit during the session is a commit of the build that made it, and a
    // store proven newer than the compile that produced it never arrives
    // (measured: every first session waited out its deadline).
    stored: (since) => cacheCommitted(cacheDir, since),
    // Farm's Compiler API has no close/dispose method; the process owns it.
    close: () => undefined,
  };
}

/**
 * Whether every store of Farm's persistent cache committed after `since`.
 *
 * In development Farm writes its cache on a thread of its own after each
 * compile, one store at a time in parallel: the store's data files first, each
 * truncated and rewritten in place, and its manifest `farm-cache.json` last.
 * The next session reads each manifest as it starts and panics on one it cannot
 * parse, so a process that exits while the thread still writes leaves a cache
 * no session can open, which the first data file's timestamp had already called
 * stored. Measured on Farm 1.7: every session rewrites the manifest of each of
 * its five stores, edited or not, and the manifests land seconds after the
 * first data file. A store is committed once its manifest is newer than `since`
 * and parses; a cache is stored once every store is.
 */
function cacheCommitted(cacheDir, since) {
  let entries;
  try {
    entries = fs.readdirSync(cacheDir, { recursive: true });
  } catch {
    return false;
  }
  const manifests = entries
    .map(String)
    .filter((entry) => path.basename(entry) === "farm-cache.json");
  return (
    manifests.length !== 0 &&
    manifests.every((manifest) => {
      const file = path.join(cacheDir, manifest);
      try {
        if (fs.statSync(file).mtimeMs < since) return false;
        JSON.parse(fs.readFileSync(file, "utf8"));
        return true;
      } catch {
        return false;
      }
    })
  );
}
