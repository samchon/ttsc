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
 *
 * With `cache`, the compiler runs over the host's persistent cache, stored
 * beside the project as soon as a build ends, and the session reports
 * `stored()` once that cache is on disk.
 */
export async function openSession(name, project, { cache = false } = {}) {
  const bundler =
    name === "webpack"
      ? (await import("webpack")).default
      : (await import("@rspack/core")).rspack;
  const plugin = await adapter(name, project.options);
  const events = eventQueue();
  let starts = [];
  const cacheDirectory = path.join(project.physical, ".cache", name);
  let logged = "";
  const log = (...parts) => {
    logged = `${logged}${parts.map(String).join(" ")}
`.slice(-64_000);
  };
  const compiler = bundler({
    context: project.root,
    mode: "development",
    devtool: false,
    entry: project.entry,
    ...(cache
      ? {
          cache: persistentCache(name, cacheDirectory),
          // The host's own verdict on its cache, for a restart that compiled
          // to name what its snapshot rejected (`output()`).
          infrastructureLogging: {
            level: "verbose",
            debug: /webpack\.cache|FileSystemInfo|rspack\.cache/,
            console: {
              debug: log,
              error: log,
              info: log,
              log,
              trace: log,
              warn: log,
            },
          },
        }
      : {}),
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
    stored: (since) => cacheCommitted(name, cacheDirectory, since),
    output: () => logged,
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

/**
 * The host's persistent cache configuration, stored under `directory` and
 * written as soon as a build ends rather than after the host's idle timeout.
 */
function persistentCache(name, directory) {
  return name === "webpack"
    ? {
        type: "filesystem",
        cacheDirectory: directory,
        idleTimeout: 0,
        idleTimeoutForInitialStore: 0,
      }
    : { type: "persistent", storage: { type: "filesystem", directory } };
}

/**
 * Whether the host's persistent cache committed after `since`.
 *
 * Webpack's `PackFileCacheStrategy` writes its content packs (`0.pack`, ...)
 * first and `index.pack`, which names them, last, one directory per cache name
 * below the cache directory; a session that ends between the two leaves a store
 * the next session restores nothing from, which the first pack's time had
 * already called stored. Rspack's filesystem storage writes each scope's packs
 * and then the root `_meta`. A store is committed once its index is newer than
 * `since`, and the cache once every store that exists is.
 */
function cacheCommitted(name, cacheDirectory, since) {
  const committedAfter = (file) => {
    try {
      return fs.statSync(file).mtimeMs >= since;
    } catch {
      return false;
    }
  };
  if (name === "rspack")
    return committedAfter(path.join(cacheDirectory, "_meta"));
  let stores;
  try {
    stores = fs
      .readdirSync(cacheDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return false;
  }
  return (
    stores.length !== 0 &&
    stores.every((store) =>
      committedAfter(path.join(cacheDirectory, store, "index.pack")),
    )
  );
}
