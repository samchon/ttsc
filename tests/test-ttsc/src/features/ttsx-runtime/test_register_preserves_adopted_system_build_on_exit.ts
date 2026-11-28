import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { systemRuntimeCachePath } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeCachePath";
import { TestProject } from "../../../../utils/src/TestProject";
import { requestRuntimeEmit } from "../../internal/runtime-adoption-actor";

/**
 * A real Node register host returns its adopted system build on normal exit.
 *
 * @evidence contracts/testing.md#behavioral-verification The maintained register hook prepares a native TypeScript entry. While its run is live, the program uses the existing cache actor to take a real parked build in that run, then normal exit returns it and removes the run.
 * @evidence contracts/testing.md#independent-expectations Authored stdout and status seven are checked directly. Exact JavaScript bytes survive at a new parked address, with no producer invocation allowed on the adoption.
 * @evidence contracts/testing.md#distinguishing-cases An ordinary file blocks project-local cache placement independently of permissions. The source-loader process uses the guard and store established by the actual register entry; the separate cache actor isolates ownership replay from native compiler cache eligibility.
 * @evidence contracts/testing.md#execution-ownership One bounded Node process loads maintained source, invokes installed native TypeScript and joins before its tree is inspected. The fixture owns its temporary paths and unlinks the package junction before removing the surrounding tree.
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
      '{"compilerOptions":{"module":"CommonJS","types":[]},"files":["main.ts"]}\n',
    );
    const runtime = systemRuntimeCachePath(project, temporary);
    const store = path.join(runtime, "runtime-builds");
    const index = path.join(runtime, "project");
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
      `declare const process: { exitCode?: number };
       declare function require(name: string): {
         readdirSync(directory: string): string[];
       };
       declare function adoptFixtureBuild(store: string, run: string, build: boolean, system: string): string;
       export {};
       const index = ${JSON.stringify(index)};
       const [run, ...other] = require("node:fs").readdirSync(index);
       if (!run?.startsWith("register-") || other.length)
         throw new Error("expected the registered entry's one system run");
       console.log(adoptFixtureBuild(
         ${JSON.stringify(store)}, index + ${JSON.stringify(path.sep)} + run, false, ${JSON.stringify(runtime)}
       ));
       process.exitCode = 7;
      `,
    );
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
          TTSX_DISABLE_CACHE: undefined,
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
    assert.equal(run.signal, null);
    assert.equal(run.status, 7, run.stderr);
    assert.equal(run.stdout.trim(), "exports.value = 47;");
    assert.match(run.stderr, /"outcome":"reused","reason":"parked"/);
    assert.deepEqual(fs.readdirSync(index), []);
    const [after, ...otherAfter] = fs.readdirSync(parked);
    assert.ok(after);
    assert.deepEqual(otherAfter, []);
    assert.notEqual(after, before);
    assert.equal(
      fs.readFileSync(path.join(parked, after, "outputs", "main.js"), "utf8"),
      "exports.value = 47;",
    );
  } finally {
    if (linkedCompiler) {
      if (process.platform === "win32") fs.rmdirSync(installed);
      else fs.unlinkSync(installed);
    }
    fs.rmSync(root, { recursive: true });
  }
}
