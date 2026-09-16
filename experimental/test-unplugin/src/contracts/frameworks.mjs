import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { deadline, eventually, fixture, workspace, write } from "./common.mjs";

/** Drive both of Next's real development compilers through HTTP requests. */
export async function nextContract(bundler) {
  const project = fixture(`next-${bundler}`);
  write(
    project.root,
    "pages/index.tsx",
    'import { value } from "../src/main"; export default function Page() { return <p data-contract="value">{value}</p>; }',
  );
  write(
    project.root,
    "next.config.mjs",
    [
      'import withTtsc from "@ttsc/unplugin/next";',
      `export default withTtsc({ devIndicators: false, turbopack: { root: ${JSON.stringify(workspace)} } }, ${JSON.stringify(project.options)});`,
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
  try {
    await deadline(ready, `Next ${bundler} ready`, 120_000);
    const read = async () => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60_000),
      });
      const html = await response.text();
      assert.equal(response.status, 200, html.slice(0, 2000));
      return html;
    };
    assert.ok(
      (await read()).includes('data-contract="value">FIRST</p>'),
      `Next ${bundler} first page`,
    );
    const initial = project.runs();
    // Next owns separate server/client compiler sessions. Repeated requests
    // must reuse their generations; a request-count wall-clock proxy cannot
    // establish this contract on a loaded CI machine.
    for (let index = 0; index < 3; index++)
      assert.ok((await read()).includes("FIRST"));
    assert.equal(
      project.runs(),
      initial,
      `Next ${bundler} recompiles no unchanged request`,
    );
    project.change("SECOND");
    await eventually(
      read,
      (html) => html.includes('data-contract="value">SECOND</p>'),
      `Next ${bundler} compiler-only edit`,
    );
    assert.ok(
      project.runs() > initial,
      "the changed compiler input must produce a new generation",
    );
    const changed = project.runs();
    assert.ok((await read()).includes("SECOND"));
    assert.equal(project.runs(), changed);
  } catch (error) {
    throw new Error(`Next ${bundler}: ${error.stack ?? error}\n${output}`);
  } finally {
    // A dev CLI owns long-lived framework workers. Stop its process tree after
    // the assertions, then wait for exit before the fixture can be reused.
    if (child.exitCode === null && child.signalCode === null) {
      if (process.platform === "win32")
        await promisify(execFile)(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true },
        );
      else child.kill("SIGTERM");
    }
    await deadline(exited, `Next ${bundler} shutdown`, 15_000);
  }
}

/** Bun build sessions and preload sessions own different cache lifetimes. */
export async function bunContract() {
  const project = fixture("bun");
  const run = promisify(execFile);
  await run(
    "bun",
    [fileURLToPath(new URL("./bun-worker.mjs", import.meta.url)), project.root],
    {
      cwd: project.root,
      env: process.env,
      windowsHide: true,
      timeout: 120_000,
    },
  );
  write(
    project.root,
    "bunfig.toml",
    'preload = ["@ttsc/unplugin/bun-register"]\n',
  );
  for (const value of ["RUNTIME_FIRST", "RUNTIME_SECOND"]) {
    project.change(value);
    const { stdout } = await run("bun", ["run", "src/main.ts"], {
      cwd: project.root,
      env: process.env,
      windowsHide: true,
      timeout: 120_000,
    });
    assert.equal(stdout.trim(), [value, value, value, value].join(" "));
  }
}
