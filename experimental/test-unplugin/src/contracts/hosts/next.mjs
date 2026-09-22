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
      'import { PROJECT_RECORD_DIRECTORY, hostToolDirectory } from "@ttsc/unplugin/api";',
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
      "export default withTtsc({",
      "  devIndicators: false,",
      `  turbopack: { root: ${JSON.stringify(workspace)}, rules: ${JSON.stringify(rules)} },`,
      "  webpack(config) {",
      // webpack's cache says what it restored, which a failure that expected
      // a restore needs to name; the verdict on each module's snapshot is a
      // compilation logger's, read from `stats` at `done`, with each pass of
      // each compiler and the records as it saw them.
      '    config.infrastructureLogging = { level: "verbose", debug: /webpack\\.cache/ };',
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
    ].join("\n"),
  );
  const require = createRequire(import.meta.url);
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
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
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
          sharedEdit: (before) =>
            assert.equal(
              project.runs() - before,
              1,
              `${name} recompiles an edit once across its workers`,
            ),
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
    // When the last build of any of Next's compilers ended, as they report it
    // themselves (`observe-pass`): the store must be newer than that, since a
    // pack committed on an earlier idle window holds an earlier build's
    // snapshots, and a session restored from it rebuilds what that build had
    // already recorded.
    builtAt: () => {
      let last = 0;
      for (const [, ended] of output.matchAll(
        / pass \d+\.\.\d+ done at (\d+)/g,
      )) {
        last = Math.max(last, Number(ended));
      }
      return last;
    },
    // Whether the last pass of every one of Next's compilers began after the
    // record last moved, which is when the modules they hold carry a snapshot
    // the next session accepts: webpack rejects a cached module whose snapshot
    // began before a dependency's last change, and the adapter writes the
    // record inside the build that produced it. Each compiler reports its
    // pass and the records as it saw them (`observe-pass`).
    cacheSettled: () => {
      // The last pass that ended, with the records as it saw them then: a
      // pass still running is not that pass, since the delivery inside it is
      // what writes the record.
      const passes = [
        ...output.matchAll(/ pass (\d+)\.\.\d+ done at \d+; records (\S*)/g),
      ];
      if (passes.length === 0) return false;
      const [, startedAt, records] = passes[passes.length - 1];
      let moved = 0;
      for (const [, stamp] of records.matchAll(/@(\d+):\d+/g)) {
        moved = Math.max(moved, Number(stamp));
      }
      return Number(startedAt) > moved;
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
      return commits.length !== 0 && commits.every((mtime) => mtime >= since);
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
  return [...stores.values()];
}
