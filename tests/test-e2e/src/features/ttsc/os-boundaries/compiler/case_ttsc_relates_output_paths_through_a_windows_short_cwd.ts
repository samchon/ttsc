import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
import { TestProject } from "../../../../../../utils/src/TestProject";
import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { isolatedCacheEnvironment } from "../../../../internal/ttsc/internal/isolated-cache-environment";

const childProcess = { ...nodeChildProcessForTrace, ...E2eProcessTrace };

/**
 * Verifies paths printed through a Windows 8.3 cwd stay project-relative.
 *
 * `fs.realpathSync` can retain a short component while `.native` expands it.
 * Comparing those flavors put a cache or single-file output outside the cwd
 * even though both named the same project. This case runs where the test volume
 * actually supplies distinct short and long spellings. The returned boolean
 * lets the installed runner distinguish verified coverage from an unavailable
 * alias without calling that capability branch a pass.
 *
 * 1. Create a private project below the installed consumer and query its short
 *    alias.
 * 2. Clean one legacy cache and compile one positional source through it.
 * 3. Assert both reported paths stay relative to that cwd.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs clean and single-file compilation through a Windows short cwd, checking project-relative removed-cache text, exact relative emitted-path stdout and the actual output file.
 * @evidence contracts/testing.md#independent-expectations The authored lib/src/index.js output and node_modules/.ttsc cache directory determine expected relative spellings; the native cmd short-path query and filesystem long path establish whether the alias distinction exists.
 * @evidence contracts/testing.md#distinguishing-cases Windows 8.3 versus long cwd spelling must retain one logical project for cleanup and nested single-file emit. Non-Windows and unavailable short-alias states do not exercise these assertions.
 * @evidence contracts/testing.md#execution-ownership The named os-boundaries/compiler export is called by the existing installed Windows batch with its SDK launcher; it executes actual native path/process behavior and shares that installation.
 * @evidence contracts/e2e.md#necessary-boundary Actual kernel short-name identities must pass through the installed launcher and filesystem output resolution; synthetic string path units cannot prove Windows supplies and resolves both spellings.
 * @evidence contracts/e2e.md#shared-execution The caller supplies its already installed SDK launcher and consumer root; the fixture reuses that consumer installation's TypeScript dependency; one native short-name query and two product commands share one private project and no extra install or Go build is performed. Clean and emit have different effects and require separate command lifetimes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns and retains the private project/owned ancestry before child launch; isolatedCacheEnvironment confines intended clean targets. Workspace compiler overrides are removed. Actual synchronous error/signal/status is distinct from arbitrary descendant join or loaded-image identity; unavailable alias returns false without coverage certification.
 * @evidence contracts/e2e.md#preserved-coverage All original cache-removal transcript, exact emitted-path stdout and actual file assertions remain. A false result explicitly reports unavailable short-name coverage; only a true result follows every real clean/emit assertion.
 */
export const case_ttsc_relates_output_paths_through_a_windows_short_cwd = (
  ttscBinary: string = TestProject.TTSC_BIN,
  consumerRoot?: string,
): boolean => {
  if (process.platform !== "win32") return false;
  const root = TestProject.tmpdir("ttsc-short-cwd-", consumerRoot);
  TestProject.retainTemporaryDirectory(
    root,
    "installed short-cwd synchronous children have no descendant join acknowledgement",
  );
  const files = FixtureFiles.read(
    "ttsc/ttsc_relates_output_paths_through_a_windows_short_cwd/inputs-1",
  );
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
  }
  const queried = childProcess.spawnSync(
    path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
    ["/d", "/c", `for %I in ("${root}") do @echo %~sI`],
    {
      encoding: "utf8",
      windowsHide: true,
      windowsVerbatimArguments: true,
    },
  );
  assert.equal(queried.error, undefined, "short-name query launch error");
  assert.equal(queried.signal, null, "short-name query terminated by signal");
  assert.equal(queried.status, 0, queried.stderr);
  const short = queried.stdout.trim();
  const long = fs.realpathSync.native(root);
  if (short.toLowerCase() === long.toLowerCase()) return false;
  fs.mkdirSync(path.join(root, "node_modules", ".ttsc"), { recursive: true });

  const spawn = (
    binary: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv },
  ) => {
    const env = { ...process.env, ...options.env };
    for (const name of Object.keys(env))
      if (["TTSC_BINARY", "TTSC_TSGO_BINARY"].includes(name.toUpperCase()))
        delete env[name];
    return childProcess.spawnSync(process.execPath, [binary, ...args], {
      cwd: options.cwd,
      env,
      encoding: "utf8",
      windowsHide: true,
    });
  };

  const clean = spawn(ttscBinary, ["clean", "--cwd", short], {
    cwd: short,
    env: isolatedCacheEnvironment(root),
  });
  assert.equal(clean.error, undefined, "installed clean launch error");
  assert.equal(clean.signal, null, "installed clean terminated by signal");
  assert.equal(clean.status, 0, clean.stderr);
  assert.ok(
    clean.stdout
      .split(/\r?\n/)
      .includes(`ttsc: removed ${path.join("node_modules", ".ttsc")}`),
    clean.stdout,
  );

  const build = spawn(ttscBinary, ["--cwd", short, "src/index.ts"], {
    cwd: short,
  });
  assert.equal(
    build.error,
    undefined,
    "installed positional emit launch error",
  );
  assert.equal(
    build.signal,
    null,
    "installed positional emit terminated by signal",
  );
  assert.equal(build.status, 0, `${build.stdout}${build.stderr}`);
  assert.equal(build.stdout.trim(), path.join("lib", "src", "index.js"));
  assert.equal(fs.existsSync(path.join(root, "lib", "src", "index.js")), true);
  return true;
};
