import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

/**
 * Verifies a child process that lost the runtime manifest runs the source as it
 * is now on the next run, and leaves no cache behind.
 *
 * Pins samchon/ttsc#1405. A child whose environment drops
 * `TTSX_RUNTIME_MANIFEST` still has the runtime hooks, but no run to share a
 * cache with. Its project builds went to a persistent, shared temp directory
 * keyed only by the tsconfig path, so after the source was edited the child
 * kept running its first build until the temp directory was cleared. Such a
 * child now builds into a directory private to its own process, removed when it
 * exits.
 *
 * 1. Create a project whose entry spawns `node src/child.ts` without the manifest,
 *    and prints what the child printed along with its pid.
 * 2. Run it, edit `src/child.ts`, and run it again.
 * 3. Assert each run prints its own version, and that no private cache directory
 *    of either child remains.
 * 4. On non-root POSIX, deny traversal of an acquired cache and verify that the
 *    same process can claim another private cache.
 *
 * @evidence contracts/testing.md#behavioral-verification Two ttsx runs each spawn a Node child with its manifest removed. The v1/v2 output must match the rewrite and neither PID may leave a private cache. A non-root POSIX actor claims through the runtime cache API, proves native lstat refusal on the cached path, then claims the second candidate in the same process.
 * @evidence contracts/testing.md#independent-expectations The authored versions determine fresh execution. A PID and literal cache prefix identify cleanup targets, and separately owned temp parents identify the expected first and second claims.
 * @evidence contracts/testing.md#distinguishing-cases Two source versions at one path distinguish fresh execution from stale reuse. The POSIX actor distinguishes a reusable cached directory from a traversability failure followed by an alternate claim.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns both launcher dispatches and the extra POSIX Node actor. TestProject supplies prepared binaries, owned fixtures and completed process results.
 * @evidence contracts/e2e.md#necessary-boundary Inherited hooks, manifest removal, native permission denial and child exit drive actual runtime behavior. A standalone cache-key read cannot prove source execution, reacquisition or exit cleanup.
 * @evidence contracts/e2e.md#shared-execution Two launcher and entry pairs share one project. Separate lifetimes prove cross-run source invalidation. One POSIX Node actor reuses the built SDK and never starts a compiler.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Child bytes are rewritten before each launch. The POSIX actor owns two fixture-local temp parents, restores traversal before exit, and preserves one module instance across the failed reuse. The test checks both of its cache directories after exit and removes the fixture.
 * @evidence contracts/e2e.md#preserved-coverage Original version/status and both PID-prefix checks remain. The added actor requires actual denied reuse, the expected alternate placement and cleanup of both claims. Root and Windows hosts skip only the POSIX permission actor.
 */
export function test_ttsx_manifest_less_child_runs_the_edited_source_on_the_next_run() {
  const child = (version: string): string =>
    [
      `declare const process: { pid: number };`,
      `const version: string = "${version}";`,
      `console.log(version + ":" + process.pid);`,
      `export {};`,
      ``,
    ].join("\n");
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "manifest-less", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "lib",
        types: [],
      },
      include: ["src"],
    }),
    "src/main.ts": [
      `declare const require: (id: string) => any;`,
      `declare const process: { env: Record<string, string | undefined>; execPath: string };`,
      `declare const __dirname: string;`,
      `const { spawnSync } = require(${JSON.stringify(E2eProcessTrace.runtimePath)});`,
      `const path = require("node:path");`,
      `const env = { ...process.env };`,
      `delete env.TTSX_RUNTIME_MANIFEST;`,
      `const result = spawnSync(process.execPath, [path.join(__dirname, "child.ts")], { env, encoding: "utf8" });`,
      `if (result.status !== 0) throw new Error(result.stderr);`,
      `console.log(result.stdout.trim());`,
      `export {};`,
      ``,
    ].join("\n"),
    "src/child.ts": child("v1"),
  });

  const pids: string[] = [];
  for (const version of ["v1", "v2"]) {
    TestProject.writeFiles(root, { "src/child.ts": child(version) });
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    const [printed, pid] = result.stdout.trim().split(":");
    assert.equal(printed, version);
    pids.push(pid!);
  }

  const parent = path.join(os.tmpdir(), "ttsx-dep");
  const remaining = fs.existsSync(parent) ? fs.readdirSync(parent) : [];
  for (const pid of pids) {
    assert.deepEqual(
      remaining.filter((name) => name.startsWith(`process-${pid}-`)),
      [],
      `the child ${pid} left its private cache behind`,
    );
  }
  if (process.platform !== "win32" && process.getuid?.() !== 0)
    verifyDeniedDependencyCacheReuse(root);
}

/** Exercise cache reuse and alternate acquisition in one isolated Node child. */
function verifyDeniedDependencyCacheReuse(projectRoot: string): void {
  const fixture = TestProject.physicalPath(
    TestProject.tmpdir("ttsx-denied-dependency-cache-"),
  );
  const primary = path.join(fixture, "primary");
  const alternate = path.join(fixture, "alternate");
  const ambient = path.join(fixture, "ambient");
  const sdk = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages/ttsc/lib/launcher/internal/runtime/dependencyCacheRoot.js",
  );
  try {
    fs.mkdirSync(primary);
    fs.mkdirSync(alternate);
    fs.symlinkSync(primary, ambient, "dir");
    const result = TestProject.spawn(
      process.execPath,
      [
        "-e",
        `
          const assert = require("node:assert/strict");
          const fs = require("node:fs");
          const path = require("node:path");
          const { dependencyCacheRoot } = require(process.argv[1]);
          const [primary, alternate, ambient] = process.argv.slice(2);
          const first = dependencyCacheRoot({}, process.cwd());
          const firstParent = path.dirname(first);
          assert.equal(firstParent, path.join(primary, "ttsx-dep"));
          assert.equal(dependencyCacheRoot({}, process.cwd()), first);
          fs.chmodSync(firstParent, 0o600);
          try {
            assert.throws(() => fs.lstatSync(first), { code: "EACCES" });
            fs.unlinkSync(ambient);
            fs.symlinkSync(alternate, ambient, "dir");
            const second = dependencyCacheRoot({}, process.cwd());
            assert.equal(path.dirname(second), path.join(alternate, "ttsx-dep"));
          } finally {
            fs.chmodSync(firstParent, 0o700);
          }
        `,
        sdk,
        primary,
        alternate,
        ambient,
      ],
      {
        cwd: projectRoot,
        env: {
          NODE_OPTIONS: undefined,
          TMPDIR: ambient,
          TTSX_RUNTIME_MANIFEST: undefined,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    for (const parent of [primary, alternate])
      assert.deepEqual(fs.readdirSync(path.join(parent, "ttsx-dep")), []);
  } finally {
    if (fs.lstatSync(ambient, { throwIfNoEntry: false }) !== undefined)
      fs.unlinkSync(ambient);
    fs.rmSync(fixture, { recursive: true });
  }
}
