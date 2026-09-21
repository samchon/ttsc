import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

import {
  deadline,
  eventually,
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
      'import withTtsc from "@ttsc/unplugin/next";',
      "export default withTtsc({",
      "  devIndicators: false,",
      `  turbopack: { root: ${JSON.stringify(workspace)}, rules: ${JSON.stringify(rules)} },`,
      "  webpack(config) {",
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
  const request = async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    return { status: response.status, html: await response.text() };
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
          `${error.message}\nsentinels ${JSON.stringify(sentinelStates(project.root))}\n${output}`,
        );
      }),
    failed: (label, pattern) =>
      eventually(
        request,
        ({ status, html }) => status === 500 && pattern.test(html),
        describe(label),
        90_000,
      ),
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
    close,
  };
}

/** Each bridge sentinel below the project's tool directory, with its contents. */
function sentinelStates(root) {
  const tool = path.join(root, ".ttsc");
  const states = {};
  let directories = [];
  try {
    directories = fs
      .readdirSync(tool)
      .filter((name) => name.startsWith("ttsc-watch-bridge-"));
  } catch {
    return states;
  }
  for (const directory of directories) {
    try {
      for (const file of fs.readdirSync(path.join(tool, directory))) {
        states[`${directory}/${file}`] = fs.readFileSync(
          path.join(tool, directory, file),
          "utf8",
        );
      }
    } catch {
      // A bridge directory removed between the listing and the read.
    }
  }
  return states;
}
