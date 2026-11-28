import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { systemRuntimeCachePath } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeCachePath";
import { systemRuntimeRunCanChange } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeRunCanChange";
import { systemRuntimeRunTree } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeRunTree";
import { TestProject } from "../../../../utils/src/TestProject";
import { requestRuntimeEmit } from "../../internal/runtime-adoption-actor";

/**
 * Register returns an adopted system build or leaves a recoverable run.
 *
 * @evidence contracts/testing.md#behavioral-verification The native register entry takes a parked build. Normal exit returns it, a project in the lock tree defers cleanup without changing that tree, and the next register host recovers a process killed after emitting an imported project marker.
 * @evidence contracts/testing.md#independent-expectations Authored stdout, status seven, unchanged lock contents, and exact parked JavaScript bytes are checked directly. Adopters cannot silently build replacement output.
 * @evidence contracts/testing.md#distinguishing-cases A file blocks project-local placement independently of permissions. The register entry selects the system guard and store. Lock projects, edited emit markers, abrupt death and ordinary release exercise distinct ownership paths.
 * @evidence contracts/testing.md#execution-ownership Bounded Node children invoke installed native TypeScript and join sequentially before the shared fixture tree is inspected. The fixture unlinks its package junction before removing the tree.
 */
export function test_register_preserves_adopted_system_build_on_exit(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-register-exit-")),
  );
  const project = path.join(root, "project");
  const temporary = path.join(root, "system-temp");
  const installed = path.join(project, "node_modules", "typescript");
  const entry = path.join(project, "main.ts");
  const loader = new URL(
    "../../../../../config/register-unit-loader.mjs",
    import.meta.url,
  ).href;
  const register = new URL(
    "../../../../../packages/ttsc/src/register.ts",
    import.meta.url,
  ).href;
  const buildPath = new URL(
    "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeBuildPath.ts",
    import.meta.url,
  ).href;
  const actor = new URL(
    "../../internal/runtime-adoption-actor.ts",
    import.meta.url,
  ).href;
  const probeSource = new URL(
    "../../../../../packages/ttsc/src/launcher/internal/runtime/interopProbe.ts",
    import.meta.url,
  ).href;
  // Supply the installed probe's authored source without building packages.
  const bootstrap =
    "data:text/javascript," +
    encodeURIComponent(
      `import { registerHooks } from "node:module";
      import { requestRuntimeEmit } from ${JSON.stringify(actor)};
      globalThis.adoptFixtureBuild = requestRuntimeEmit;
      registerHooks({
        resolve(specifier, context, nextResolve) {
          return nextResolve(specifier === ${JSON.stringify(probeSource.replace(/\.ts$/, ".js"))}
            ? ${JSON.stringify(probeSource)} : specifier, context);
        }
      });`,
    );
  let linkedCompiler = false;
  try {
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.mkdirSync(temporary);
    fs.symlinkSync(
      fs.realpathSync.native(
        path.join(TestProject.WORKSPACE_ROOT, "node_modules", "typescript"),
      ),
      installed,
      process.platform === "win32" ? "junction" : "dir",
    );
    linkedCompiler = true;
    fs.writeFileSync(
      path.join(project, "node_modules", ".cache"),
      "blocked default cache\n",
    );
    fs.writeFileSync(path.join(project, "package.json"), '{"private":true}\n');
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      '{"compilerOptions":{"module":"CommonJS","resolveJsonModule":true,"types":[]},"files":["main.ts"]}\n',
    );
    fs.mkdirSync(path.join(project, "copied"));
    const markerContents = '{"private":true,"name":"copied-project"}\n';
    fs.writeFileSync(
      path.join(
        project,
        "copied",
        process.platform === "win32" ? "package.JSON" : "package.json",
      ),
      markerContents,
    );
    const runtime = systemRuntimeCachePath(project, temporary);
    const store = path.join(runtime, "runtime-builds");
    const index = path.join(runtime, "project");
    const retired = path.join(`${runtime}.lock`, "retired");
    const lockMarker = path.join(retired, "package.json");
    const lockSnapshot = path.join(project, "retired.json");
    const seed = path.join(index, "seed");
    fs.mkdirSync(runtime, { recursive: true });
    assert.equal(
      requestRuntimeEmit(store, seed, true, runtime),
      "exports.value = 47;",
    );
    fs.rmSync(seed, { recursive: true });
    const pending = fs
      .readdirSync(store)
      .filter((name) => name.endsWith(".pending"));
    assert.equal(pending.length, 1);
    const parked = path.join(store, pending[0]!);
    const [before, ...otherBefore] = fs.readdirSync(parked);
    assert.ok(before);
    assert.deepEqual(otherBefore, []);

    fs.writeFileSync(
      entry,
      `import metadata = require("./copied/package.json");
       declare const process: { argv: string[]; pid: number; exitCode?: number; kill(pid: number, signal: string): void };
       declare function require(name: string): {
         readdirSync(directory: string): string[];
         writeFileSync(file: string, content: string): void;
         writeSync(fd: number, content: string): void;
       };
       declare function adoptFixtureBuild(store: string, run: string, build: boolean, system: string): string;
       if (metadata.name !== "copied-project") throw new Error("wrong JSON import");
       const fs = require("node:fs");
       const index = ${JSON.stringify(index)};
       const [run, ...other] = fs.readdirSync(index);
       if (!run?.startsWith("register-") || other.length)
         throw new Error("expected the registered entry's one system run");
       fs.writeSync(1, adoptFixtureBuild(
         ${JSON.stringify(store)}, index + ${JSON.stringify(path.sep)} + run, false, ${JSON.stringify(runtime)}
       ) + "\\n");
       if (process.argv[2] === "protect-lock") {
         fs.writeFileSync(${JSON.stringify(lockMarker)}, ${JSON.stringify(markerContents)});
         fs.writeFileSync(${JSON.stringify(lockSnapshot)}, JSON.stringify(fs.readdirSync(${JSON.stringify(retired)}).sort()));
       }
       if (process.argv[2] === "kill") process.kill(process.pid, "SIGKILL");
       process.exitCode = 7;
      `,
    );
    const start = (mode: "exit" | "protect-lock" | "kill") => {
      const run = spawnSync(
        process.execPath,
        [
          "--import",
          loader,
          "--import",
          bootstrap,
          "--import",
          buildPath,
          "--import",
          register,
          entry,
          mode,
        ],
        {
          cwd: project,
          encoding: "utf8",
          timeout: 30_000,
          windowsHide: true,
          env: {
            ...process.env,
            NODE_OPTIONS: undefined,
            TTSC_CACHE_DIR: undefined,
            TTSC_TSGO_BINARY: undefined,
            TTSX_DISABLE_CACHE: mode === "kill" ? "1" : undefined,
            TTSX_RUNTIME_CACHE_DIR: undefined,
            TTSX_RUNTIME_MANIFEST: undefined,
            TTSX_RUNTIME_RUN_DIR: undefined,
            TTSX_RUNTIME_RUNS_DIR: undefined,
            TTSC_EXPLAIN_CACHE: "1",
            TEMP: temporary,
            TMP: temporary,
            TMPDIR: temporary,
          },
        },
      );
      assert.ifError(run.error);
      assert.equal(run.stdout.trim(), "exports.value = 47;", run.stderr);
      assert.match(run.stderr, /"outcome":"reused","reason":"parked"/);
      if (mode === "kill") {
        if (process.platform === "win32") assert.equal(run.status, 1);
        else assert.equal(run.signal, "SIGKILL");
      } else {
        assert.equal(run.signal, null);
        assert.equal(run.status, 7, run.stderr);
      }
    };
    const assertParked = (previous: string): string => {
      assert.deepEqual(fs.readdirSync(index), []);
      const [current, ...other] = fs.readdirSync(parked);
      assert.ok(current);
      assert.deepEqual(other, []);
      assert.notEqual(current, previous);
      assert.equal(
        fs.readFileSync(
          path.join(parked, current, "outputs", "main.js"),
          "utf8",
        ),
        "exports.value = 47;",
      );
      return current;
    };

    start("exit");
    const afterExit = assertParked(before);

    start("protect-lock");
    assert.equal(fs.readdirSync(index).length, 1);
    assert.equal(fs.readFileSync(lockMarker, "utf8"), markerContents);
    assert.equal(
      JSON.stringify(fs.readdirSync(retired).sort()),
      fs.readFileSync(lockSnapshot, "utf8"),
    );
    fs.unlinkSync(lockMarker);
    start("exit");
    const afterLockRecovery = assertParked(afterExit);

    start("kill");
    const [abandoned, ...otherAbandoned] = fs.readdirSync(index);
    assert.ok(abandoned);
    assert.deepEqual(otherAbandoned, []);
    const abandonedRun = path.join(index, abandoned);
    const emitted = path.join(abandonedRun, "fs");
    const markers = fs
      .readdirSync(emitted, { recursive: true, encoding: "utf8" })
      .filter((relative) => path.basename(relative) === "package.json");
    assert.equal(markers.length, 1);
    const outputMarker = path.join(emitted, markers[0]!);
    const compiledMarker = fs.readFileSync(outputMarker, "utf8");
    assert.deepEqual(JSON.parse(compiledMarker), JSON.parse(markerContents));
    const guard = (directory: string) =>
      systemRuntimeRunCanChange(directory, runtime, [project]);
    assert.equal(systemRuntimeRunTree(abandonedRun, guard), "emitted-marker");
    fs.writeFileSync(outputMarker, '{"name":"new-project"}\n');
    assert.equal(systemRuntimeRunTree(abandonedRun, guard), "protected");
    fs.writeFileSync(outputMarker, compiledMarker);
    start("exit");
    assertParked(afterLockRecovery);
  } finally {
    if (linkedCompiler) {
      if (process.platform === "win32") fs.rmdirSync(installed);
      else fs.unlinkSync(installed);
    }
    fs.rmSync(root, { recursive: true });
  }
}
