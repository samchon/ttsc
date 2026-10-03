import { TestProject } from "@ttsc/testing";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import fs from "node:fs";
import * as path from "node:path";

import { assert, ttscPackageRoot } from "../../../internal/ttsc/internal/ttscserver";

/**
 * Verifies ttscserver launcher canonicalizes `--tsgo=<path>` for sidecars.
 *
 * Locks the argument-shape regression where the launcher recognized only
 * `--tsgo <path>`. A Node-backed fake native host records its environment so
 * this test observes the explicit compiler path received by that recording
 * child. It does not execute Go-owned sidecar refreshes or the fake compiler.
 *
 * 1. Prepare distinct launcher/project cwd values, a fake tsgo path, and a
 *    project-relative Node runtime.
 * 2. Spawn the JS ttscserver launcher with TTSC_TSGO_BINARY unset.
 * 3. Pass `--cwd <project>` and `--tsgo=<binary>`.
 * 4. Assert the fake host received the exact compiler path and the runtime
 *    resolved against the project cwd rather than the launcher's cwd.
 *
 * @evidence contracts/testing.md#behavioral-verification The JavaScript launcher forwards the exact inline tsgo path and canonical project-relative Node runtime to its recording host.
 * @evidence contracts/testing.md#independent-expectations Authored separate project/launcher roots and the literal fake compiler path establish the expected received environment. Native dev/ino comparison is supplemented by independently resolved real paths when either inode is unavailable; this is not loaded-image equality.
 * @evidence contracts/testing.md#distinguishing-cases 1. Prepare distinct launcher/project cwd values, a fake tsgo path, and a project-relative Node runtime. 2. Spawn the JS ttscserver launcher with TTSC_TSGO_BINARY unset. 3. Pass `--cwd <project>` and `--tsgo=<binary>`. 4. Assert the fake host received the exact compiler path and the runtime resolved against the project cwd rather than the launcher's cwd.
 * @evidence contracts/testing.md#execution-ownership The matching src/features/ttsc/ttscserver entry is selected by test-e2e's TestExecutor. Its built JavaScript launcher executes a recording Node host; neither a packed installation nor an actual native LSP session is exercised.
 * @evidence contracts/e2e.md#necessary-boundary The actual JavaScript launcher forwards argv and resolves its project-relative runtime before executing a recording Node host; direct request planning cannot prove the environment received by that child.
 * @evidence contracts/e2e.md#shared-execution One launcher and one recording Node host carry the distinct cwd, runtime and inline-tsgo inputs; the authored fake tsgo is not executed, and no LSP session, native build or installation is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Separate retained project and launcher roots keep resolution origins distinct and effective environment child-only. A returned status or signal permits fixture cleanup; an error without either leaves inputs retained. This synchronous result does not certify arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage The JavaScript launcher forwards the exact inline tsgo path and canonical project-relative Node runtime to its recording host. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttscserver_launcher_respects_inline_tsgo_flag = () => {
  const root = ttscPackageRoot();
  const launcher = path.join(root, "lib", "launcher", "ttscserver.js");
  const cwd = TestProject.tmpdir("ttscserver-inline-tsgo-");
  const launcherCwd = TestProject.tmpdir("ttscserver-launcher-cwd-");
  TestProject.retainTemporaryDirectory(cwd);
  TestProject.retainTemporaryDirectory(launcherCwd);
  const record = path.join(cwd, "record.json");
  const fakeTsgo = path.join(cwd, "tsgo");
  const runtimeName =
    process.platform === "win32" ? "project-node.exe" : "project-node";
  const projectRuntime = path.join(cwd, runtimeName);
  fs.writeFileSync(fakeTsgo, "", "utf8");
  try {
    fs.linkSync(process.execPath, projectRuntime);
  } catch {
    fs.copyFileSync(process.execPath, projectRuntime);
  }
  if (process.platform !== "win32") fs.chmodSync(projectRuntime, 0o755);
  const fakeHostScript = [
    "const fs = require('node:fs');",
    `fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({`,
    "  args: process.argv.slice(1),",
    "  node: process.env.TTSC_NODE_BINARY || '',",
    "  tsgo: process.env.TTSC_TSGO_BINARY || '',",
    "}));",
  ].join("\n");
  const env = { ...process.env };
  env.TTSCSERVER_BINARY = process.execPath;
  env.TTSC_NODE_BINARY = `.${path.sep}${runtimeName}`;
  delete env.TTSC_TSGO_BINARY;

  let completed = false;
  try {
    const result = child_process.spawnSync(
      process.execPath,
      [
        launcher,
        "-e",
        fakeHostScript,
        "--",
        "--stdio",
        "--cwd",
        cwd,
        `--tsgo=${fakeTsgo}`,
      ],
      {
        cwd: launcherCwd,
        encoding: "utf8",
        env,
        input: "",
        maxBuffer: 1024 * 1024 * 16,
        windowsHide: true,
      },
    );
    completed = result.status !== null || result.signal !== null;
    if (result.error) throw result.error;
    assert.equal(result.signal, null);
    assert.equal(
      result.status,
      0,
      `launcher should exit cleanly\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    const recorded = JSON.parse(fs.readFileSync(record, "utf8")) as {
      args: string[];
      node: string;
      tsgo: string;
    };
    assert.deepEqual(recorded.args, [
      "--stdio",
      "--cwd",
      cwd,
      `--tsgo=${fakeTsgo}`,
    ]);
    assert.equal(path.isAbsolute(recorded.node), true);
    const actualRuntime = fs.statSync(recorded.node);
    const expectedRuntime = fs.statSync(projectRuntime);
    assert.equal(actualRuntime.dev, expectedRuntime.dev);
    assert.equal(actualRuntime.ino, expectedRuntime.ino);
    if (actualRuntime.ino === 0 || expectedRuntime.ino === 0)
      assert.equal(fs.realpathSync(recorded.node), fs.realpathSync(projectRuntime));
    assert.equal(recorded.tsgo, fakeTsgo);
  } finally {
    if (completed) {
      fs.rmSync(cwd, { recursive: true, force: true });
      fs.rmSync(launcherCwd, { recursive: true, force: true });
    }
  }
};
