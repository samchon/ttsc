import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { deadline, eventually, fixture, workspace, write } from "./common.mjs";

/** Drive both of Next's real development compilers through HTTP requests. */
export async function nextContract(bundler) {
  const project = fixture(`next-${bundler}`);
  project.break();
  write(
    project.root,
    "pages/index.tsx",
    [
      'import { value } from "../src/main";',
      ...[1, 2, 3].map(
        (i) => `import { value as value${i} } from "../src/mod${i}";`,
      ),
      'export default function Page() { return <p data-contract="value">{[value, value1, value2, value3].join("|")}</p>; }',
    ].join("\n"),
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
  let socket;
  const completedBuilds = [];
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
    socket = new WebSocket(`${url.replace("http:", "ws:")}/_next/hmr`);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.type === "built") completedBuilds.push(message);
    });
    await deadline(
      new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
      }),
      `Next ${bundler} HMR connection`,
    );
    const completed = (after) =>
      eventually(
        () => completedBuilds.slice(after),
        (builds) => builds.some((build) => build.errors.length === 0),
        `Next ${bundler} completed compiler update`,
      );
    const hasValues = (html, value) =>
      html.includes(
        `data-contract="value">${Array(4).fill(value).join("|")}</p>`,
      );
    const request = async () => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(60_000),
      });
      const html = await response.text();
      return { status: response.status, html };
    };
    const read = async () => {
      const { status, html } = await request();
      assert.equal(status, 200, html.slice(0, 2000));
      return html;
    };
    const initialFailure = await request();
    assert.equal(initialFailure.status, 500);
    assert.match(initialFailure.html, /invalid contract type/);
    let beforeUpdate = completedBuilds.length;
    project.change("FIRST");
    await eventually(
      read,
      (html) => hasValues(html, "FIRST"),
      `Next ${bundler} initial recovery`,
    );
    await completed(beforeUpdate);
    const initial = project.runs();
    // Next owns separate server/client compiler sessions. Repeated requests
    // must reuse their generations after the public HMR completion event.
    // An HTML response can precede Turbopack's background data/client builds;
    // their first compilation is not an unchanged-request cache miss.
    for (let index = 0; index < 3; index++)
      assert.ok(hasValues(await read(), "FIRST"));
    assert.equal(
      project.runs(),
      initial,
      `Next ${bundler} recompiles no unchanged request`,
    );
    beforeUpdate = completedBuilds.length;
    project.change("SECOND");
    await eventually(
      read,
      (html) => hasValues(html, "SECOND"),
      `Next ${bundler} compiler-only edit`,
    );
    await completed(beforeUpdate);
    assert.ok(
      project.runs() > initial,
      "the changed compiler input must produce a new generation",
    );
    // Turbopack's loader workers share each compile through the session
    // `withTtsc` opened, so the edit compiles once for the whole pool
    // (samchon/ttsc#1390).
    if (bundler === "turbopack")
      assert.equal(
        project.runs() - initial,
        1,
        "Next turbopack recompiles an edit once across its workers",
      );
    const changed = project.runs();
    assert.ok(hasValues(await read(), "SECOND"));
    assert.equal(project.runs(), changed);
    project.break();
    await eventually(
      request,
      ({ status, html }) =>
        status === 500 && html.includes("invalid contract type"),
      `Next ${bundler} failed rebuild`,
    );
    beforeUpdate = completedBuilds.length;
    project.change("THIRD");
    await eventually(
      read,
      (html) => hasValues(html, "THIRD"),
      `Next ${bundler} recovered rebuild`,
    );
    await completed(beforeUpdate);
    const recovered = project.runs();
    assert.ok(recovered > changed);
    assert.ok(hasValues(await read(), "THIRD"));
    assert.equal(project.runs(), recovered);
    // A new root file changes no compiler input, so only the development
    // session's bridge hears it, through the sentinel each module registered
    // (samchon/ttsc#1419). Turbopack accepts that sentinel only inside its
    // project filesystem root.
    write(project.root, "src/contract-extra.d.ts", "declare const extra: 1;\n");
    await eventually(
      async () => {
        await request();
        return project.runs();
      },
      (runs) => runs > recovered,
      `Next ${bundler} new root file recompiles`,
    );
    assert.ok(hasValues(await read(), "THIRD"));
  } catch (error) {
    throw new Error(`Next ${bundler}: ${error.stack ?? error}\n${output}`);
  } finally {
    socket?.close();
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
  project.break();
  await assert.rejects(
    run("bun", ["run", "src/main.ts"], {
      cwd: project.root,
      env: process.env,
      windowsHide: true,
      timeout: 120_000,
    }),
    /invalid contract type/,
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
