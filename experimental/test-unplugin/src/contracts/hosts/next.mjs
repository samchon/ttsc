import {
  PROJECT_RECORD_DIRECTORY,
  hostToolDirectory,
} from "@ttsc/unplugin/api";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

import {
  deadline,
  eventually,
  recordStates,
  workspace,
  write,
  writeRaceLoader,
} from "../common.mjs";

/**
 * A Next development server on the fixture, with either compiler, read through
 * HTTP requests for a page that renders the four modules' values.
 *
 * The race loader runs after ttsc in the rule's chain, under Turbopack through
 * `turbopack.rules` and under webpack through the config's `webpack` hook, and
 * lands the `LATE_RACE_` edits between ttsc returning a module and the compiler
 * recording its inputs.
 */
export async function openSession(bundler, project) {
  const name = `next-${bundler}`;
  write(
    project.root,
    "pages/index.tsx",
    [
      // The linked plugin type-checks the page: React's types declare the
      // JSX elements.
      'import * as React from "react";',
      'import { value } from "../src/main";',
      ...[1, 2, 3].map(
        (i) => `import { value as value${i} } from "../src/mod${i}";`,
      ),
      'export default function Page() { return <p data-contract="value">{[value, value1, value2, value3].join("|")}</p>; }',
    ].join("\n"),
  );
  const raceLoader = writeRaceLoader(project.root);
  const rules = { "*.ts": { loaders: [{ loader: raceLoader, options: {} }] } };
  write(
    project.root,
    "next.config.mjs",
    [
      'import fs from "node:fs";',
      'import path from "node:path";',
      'import { PROJECT_RECORD_DIRECTORY, hostToolDirectory, readTtscTransformSession } from "@ttsc/unplugin/api";',
      'import withTtsc from "@ttsc/unplugin/next";',
      // Every project record with its modification time and size, so a
      // pass's log says whether the record moved while the pass ran. The
      // adapter names where they live; the config composes the same path.
      "const records = () => {",
      `  const directory = path.join(hostToolDirectory(${JSON.stringify(project.root)}), PROJECT_RECORD_DIRECTORY);`,
      "  try {",
      "    return fs.readdirSync(directory).map((entry) => {",
      "      const stats = fs.statSync(path.join(directory, entry));",
      "      return `${entry}@${Math.round(stats.mtimeMs)}:${stats.size}`;",
      '    }).join(",") || "(none)";',
      "  } catch {",
      '    return "(none)";',
      "  }",
      "};",
      "const config = withTtsc({",
      "  devIndicators: false,",
      `  turbopack: { root: ${JSON.stringify(workspace)}, rules: ${JSON.stringify(rules)} },`,
      "  webpack(config) {",
      // webpack's cache says what it restored, which a failure that expected
      // a restore needs to name; the verdict on each module's snapshot is a
      // compilation logger's, read from `stats` at `done`, with each pass of
      // each compiler and the records as it saw them.
      '    config.infrastructureLogging = { level: "verbose", debug: /webpack\\.cache/ };',
      // Each compiler stores its cache as soon as a build ends, as the plain
      // webpack session does: webpack's own default waits a minute of idle
      // after a small change, and the contract stops the server forcibly on
      // Windows, where it gets no chance to store at exit.
      '    if (config.cache && typeof config.cache === "object") Object.assign(config.cache, { idleTimeout: 0, idleTimeoutForInitialStore: 0, idleTimeoutAfterLargeChanges: 0 });',
      "    config.plugins.push({",
      "      apply(compiler) {",
      '        compiler.hooks.compile.tap("observe-pass", () => {',
      "          process.stdout.write(`[${compiler.name}] pass started at ${Date.now()}; records ${records()}\\n`);",
      "        });",
      '        compiler.hooks.invalid.tap("observe-pass", (file, changeTime) => {',
      "          process.stdout.write(`[${compiler.name}] change reported at ${Date.now()}: ${file} (${changeTime})\\n`);",
      "        });",
      '        compiler.hooks.done.tap("observe-pass", (stats) => {',
      "          process.stdout.write(`[${compiler.name}] pass ${stats.startTime}..${stats.endTime} done at ${Date.now()}; records ${records()}\\n`);",
      '          process.stdout.write(`${stats.toString({ all: false, logging: "verbose", loggingDebug: [/FileSystemInfo/] })}\\n`);',
      "        });",
      "      },",
      "    });",
      `    config.module.rules.push({ test: /\\.ts$/, use: [{ loader: ${JSON.stringify(raceLoader)} }] });`,
      "    return config;",
      "  },",
      `}, ${JSON.stringify(project.options)});`,
      // The shared compile store `withTtsc` opened for Turbopack's loader
      // workers, which a failure to compile an edit once lists.
      'process.stdout.write(`[ttsc-session] ${readTtscTransformSession() ?? "(none)"}\\n`);',
      "export default config;",
    ].join("\n"),
  );
  const require = createRequire(import.meta.url);
  // TEMPORARY DIAGNOSTIC, reverted before merge: every capture's verdict.
  const captureLog = path.join(
    path.dirname(project.physical),
    `${path.basename(project.physical)}-captures.jsonl`,
  );
  fs.rmSync(captureLog, { force: true });
  const child = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "dev",
      `--${bundler}`,
      "--port",
      "0",
      "--hostname",
      "127.0.0.1",
    ],
    {
      cwd: project.root,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        // TEMPORARY DIAGNOSTIC, reverted before merge.
        TTSC_UNPLUGIN_CAPTURE_LOG: captureLog,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let output = "";
  let url;
  let socket;
  let hmrErrors = [];
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const consume = (chunk) => {
    output = (output + chunk.toString()).slice(-64_000);
    const plain = output.replace(/\x1b\[[0-9;]*m/g, "");
    url ??= /http:\/\/127\.0\.0\.1:\d+/.exec(plain)?.[0];
    if (url && plain.includes("Ready in")) readyResolve();
  };
  child.stdout.on("data", consume);
  child.stderr.on("data", consume);
  child.on("error", readyReject);
  const exited = new Promise((resolve) =>
    child.on("exit", (code, signal) => {
      readyReject(new Error(`Next exited ${code ?? signal}: ${output}`));
      resolve();
    }),
  );
  const close = async () => {
    socket?.close();
    // A dev CLI owns long-lived framework workers. Stop its process tree after
    // the assertions, then wait for exit before the fixture can be reused.
    if (child.exitCode === null && child.signalCode === null) {
      if (process.platform === "win32")
        // The tree may have exited between the check and the kill.
        await promisify(execFile)(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true },
        ).catch(() => undefined);
      else child.kill("SIGTERM");
    }
    await deadline(exited, `${name} shutdown`, 15_000);
  };
  try {
    await deadline(ready, `${name} ready`, 120_000);
    socket = new WebSocket(`${url.replace("http:", "ws:")}/_next/hmr`);
    hmrErrors = [];
    // A development error reaches the browser over this socket, not in the
    // page: the messages of the last errors seen name a failure.
    socket.addEventListener("message", (event) => {
      const text = String(event.data);
      const messages = [...text.matchAll(/"message":"((?:[^"\\]|\\.)*)"/g)].map(
        (match) => match[1],
      );
      if (messages.length !== 0)
        hmrErrors.push(`${Date.now()}: ${messages.join(" | ")}`.slice(0, 600));
      hmrErrors = hmrErrors.slice(-12);
    });
    await deadline(
      new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
      }),
      `${name} HMR connection`,
    );
  } catch (error) {
    await close().catch(() => undefined);
    throw new Error(`${name}: ${error.stack ?? error}\n${output}`);
  }
  // The last page read, named by a failure: a 500 page carries the error the
  // compiler or a loader reported.
  let last;
  const request = async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    last = { status: response.status, html: await response.text() };
    return last;
  };
  // A development 500 page renders its error on the client, from the JSON
  // Next embeds in the page, so the messages there are what a reader needs.
  const lastPage = () => {
    if (last === undefined) return "no page read";
    const messages = [
      ...last.html.matchAll(/"message":"((?:[^"\\]|\\.)*)"/g),
    ].map((match) => match[1]);
    const text = last.html
      .replace(/<script[^]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 600);
    return `${last.status}: ${JSON.stringify(messages).slice(0, 3000)} ${text}; errors over HMR: ${JSON.stringify(hmrErrors).slice(0, 3000)}`;
  };
  const hasValues = (html, value) =>
    html.includes(
      `data-contract="value">${Array(4).fill(value).join("|")}</p>`,
    );
  const describe = (label) => `${name} ${label} (${project.runs()} compile(s))`;
  return {
    name,
    exactRuns: false,
    lateRace: true,
    membership: true,
    settled: (label, value) =>
      eventually(
        request,
        ({ status, html }) => status === 200 && hasValues(html, value),
        describe(label),
        90_000,
      ).catch((error) => {
        throw new Error(
          `${error.message}\nlast page ${lastPage()}\nrecords ${JSON.stringify(recordStates(project))}\n${output}`,
        );
      }),
    failed: (label, pattern) =>
      eventually(
        request,
        ({ status, html }) => status === 500 && pattern.test(html),
        describe(label),
        90_000,
      ).catch((error) => {
        throw new Error(`${error.message}\nlast page ${lastPage()}`);
      }),
    // Repeated requests must reuse the generations after an edit; the
    // page's HTML can precede Turbopack's background data and client builds,
    // whose first compilation is not an unchanged-request cache miss.
    async rebuild(value) {
      for (let index = 0; index < 3; index++) {
        const { status, html } = await request();
        assert.equal(status, 200);
        assert.ok(hasValues(html, value));
      }
    },
    // Turbopack's loader workers share each compile through the session
    // `withTtsc` opened, so the edit compiles once for the whole pool
    // (samchon/ttsc#1390).
    ...(bundler === "turbopack"
      ? {
          sharedEdit: (before, editedAt) => {
            const compiled = project.runs() - before;
            if (compiled === 1) return;
            // A worker that could not adopt the publication compiles for
            // itself (`claimSharedCompile`), and the run alone cannot say
            // which worker or why. The store names what each compile
            // published, what the server reported and the records it left
            // name the state each compile read.
            assert.fail(
              [
                `${name} recompiles an edit once across its workers: ${compiled} compile(s)`,
                `the pool's shared compile store:\n${sharedStores(output)}`,
                // TEMPORARY DIAGNOSTIC, reverted before merge.
                `edited at ${editedAt}; captures:\n${(() => {
                  try {
                    return fs.readFileSync(captureLog, "utf8").trim();
                  } catch {
                    return "none";
                  }
                })()}`,
                `records ${JSON.stringify(recordStates(project))}`,
                `what the host reported:\n${output.split(/\r?\n/).slice(-60).join("\n")}`,
              ].join("\n"),
            );
          },
        }
      : {}),
    recompiled: (label, before) =>
      eventually(
        async () => {
          await request();
          return project.runs();
        },
        (runs) => runs > before,
        describe(label),
      ),
    // Whether the last pass that ended began after the record last moved,
    // which is when the modules it holds carry a snapshot the next session
    // accepts: webpack rejects a cached module whose snapshot began before a
    // dependency's last change, and the adapter writes the record inside the
    // build that produced it. Each compiler reports its passes
    // (`observe-pass`), and a pass still running is not that pass, since the
    // delivery inside it is what writes the record.
    //
    // Against the record on disk, never the stamps a pass logged: the record
    // can move after the pass that logged it, as the bridge's later moves of
    // a signal do, and a session closed between such a move and the pass
    // that follows it stores a cache older than the record.
    cacheSettled: () => {
      const passes = [...output.matchAll(/ pass (\d+)\.\.\d+ done at \d+/g)];
      if (passes.length === 0) return false;
      const startedAt = Number(passes[passes.length - 1][1]);
      return startedAt > recordsMovedAt(project.root);
    },
    // Next stores both compilers' persistent caches below a `cache`
    // directory of its output, `.next/dev` for a development session since
    // Next 16, and each store commits by writing one file last: Turbopack its
    // `CURRENT`, as LevelDB does, and each of webpack's compilers, client and
    // server, its own `index.pack`, on its own idle timeout. Only a commit of
    // every store counts; a session closed while one compiler's store is
    // pending leaves that compiler nothing to restore.
    stored: (since) => {
      const commits = cacheCommits(path.join(project.physical, ".next"));
      return (
        commits.length !== 0 && commits.every(([, mtime]) => mtime >= since)
      );
    },
    // The stronger proof: the store of every compiler that watches the record
    // is newer than that compiler's last pass, so it holds the snapshots that
    // pass took. Each store is measured against its own compiler, never the
    // session's last pass: Next runs three, and a pass of one leaves the
    // others nothing to store. A compiler that never reported the record
    // changing holds no module depending on it, so its store is held to
    // `since` alone; the edge compiler of this fixture never builds after a
    // move.
    storedAfterLastBuild: (since) => {
      const commits = cacheCommits(path.join(project.physical, ".next"));
      if (commits.length === 0) return false;
      const passes = passEndsIn(output);
      const watching = recordWatchers(output);
      return commits.every(([store, mtime]) => {
        const name = compilerOf(passes, store);
        const floor =
          name !== undefined && watching.has(name) ? passes.get(name) : 0;
        return mtime >= Math.max(since, floor);
      });
    },
    /** What the dev server wrote, its cache log among it, for a failure to name. */
    output: () => output,
    close,
  };
}

/**
 * The commit time of every persistent store below Next's output: Turbopack's
 * `CURRENT`, and each webpack compiler's `index.pack`, one per directory of
 * `cache/webpack`.
 */
/**
 * When the newest project record below a root's tool directory last moved, or
 * `0` while there is none: the development server runs in the project, so its
 * records are the ones below it.
 */
function recordsMovedAt(root) {
  const directory = path.join(
    hostToolDirectory(root),
    PROJECT_RECORD_DIRECTORY,
  );
  let moved = 0;
  try {
    for (const entry of fs.readdirSync(directory)) {
      moved = Math.max(moved, fs.statSync(path.join(directory, entry)).mtimeMs);
    }
  } catch {
    // No record yet; nothing has moved.
  }
  return moved;
}

/**
 * When each compiler of this session last reported a pass end, by the name it
 * reported it under (`observe-pass`): `client`, `server`, `edge-server`.
 */
function passEndsIn(output) {
  const ends = new Map();
  for (const [, name, ended] of output.matchAll(
    /\[([^\]]+)\] pass \d+\.\.\d+ done at (\d+)/g,
  )) {
    ends.set(name, Math.max(ends.get(name) ?? 0, Number(ended)));
  }
  return ends;
}

/**
 * The compiler a store belongs to, or `undefined` for one no compiler of this
 * session named: Next's webpack stores live one directory per compiler,
 * `cache/webpack/<compiler>-development`, and Turbopack's under
 * `cache/turbopack`, which no pass of this contract reports.
 */
function compilerOf(passes, store) {
  const directory = store.split("/").at(-1) ?? "";
  for (const name of passes.keys()) {
    if (directory.startsWith(`${name}-`)) return name;
  }
  return undefined;
}

/**
 * The compilers that reported a project record changing, by name
 * (`observe-pass`): the ones holding a module that depends on it.
 */
function recordWatchers(output) {
  const watching = new Set();
  for (const [, name] of output.matchAll(
    /\[([^\]]+)\] change reported at \d+: [^\n]*?[\\/]records[\\/]/g,
  )) {
    watching.add(name);
  }
  return watching;
}

function cacheCommits(output) {
  let entries;
  try {
    entries = fs.readdirSync(output, { recursive: true });
  } catch {
    return [];
  }
  // Every store that has begun, by its directory: a webpack compiler's below
  // `cache/webpack`, Turbopack's below `cache/turbopack`. One that only holds
  // data still being written has not committed, and counts as a store whose
  // commit is missing.
  const stores = new Map();
  for (const entry of entries) {
    const name = String(entry);
    const segments = name.split(/[/\\]/);
    const at = segments.indexOf("cache");
    if (at === -1 || segments.length < at + 3) continue;
    const store = segments.slice(0, at + 3).join("/");
    const file = segments.at(-1);
    let mtime;
    try {
      const stats = fs.statSync(path.join(output, name));
      if (!stats.isFile()) continue;
      mtime = stats.mtimeMs;
    } catch {
      continue;
    }
    const committed = file === "CURRENT" || /^index\.pack(\.gz)?$/.test(file);
    const known = stores.get(store);
    stores.set(store, committed ? mtime : (known ?? -Infinity));
  }
  return [...stores.entries()];
}

/**
 * What the shared compile stores a Next server reported (`[ttsc-session]`)
 * hold: a publication per compiled state, named `<identity>-<state>.json` and
 * naming the scratch directory of the worker that compiled it, and a lock per
 * state being compiled, naming its holder (`claimSharedCompile`).
 *
 * Two compiles of one edit that left two states read two project states. Two
 * that left one state are an adopter whose proof of the publication failed,
 * which compiles again and replaces it, or a waiter that took a lock over from
 * a holder whose heartbeat stopped.
 */
function sharedStores(output) {
  const stores = new Set(
    [...output.matchAll(/\[ttsc-session\] ([^\r\n]+)/g)].map((match) =>
      match[1].trim(),
    ),
  );
  const listed = [...stores].map((store) => {
    let entries;
    try {
      entries = fs.readdirSync(store).sort();
    } catch (error) {
      return `${store}: ${error.code ?? error.message}`;
    }
    const lines = entries.map((entry) => {
      const file = path.join(store, entry);
      try {
        const stats = fs.statSync(file);
        if (stats.isDirectory()) {
          let owner = "no owner yet";
          try {
            owner = fs.readFileSync(path.join(file, "owner"), "utf8");
          } catch {
            // Between creating the lock and naming its holder.
          }
          return `  ${entry} held by ${owner}, beat at ${Math.round(stats.mtimeMs)}`;
        }
        let compiledIn = "";
        try {
          compiledIn = `, compiled in ${JSON.parse(fs.readFileSync(file, "utf8")).scratchDirectory}`;
        } catch {
          // Not a publication, or one being replaced.
        }
        return `  ${entry} at ${Math.round(stats.mtimeMs)}${compiledIn}`;
      } catch (error) {
        return `  ${entry}: ${error.code ?? error.message}`;
      }
    });
    return [`${store}:`, ...lines].join("\n");
  });
  return listed.join("\n") || "no store was reported";
}
