import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { case_ttsx_response_watch_refusal } from "../features/ttsc/ttsx-runtime/case_ttsx_response_watch_refusal";
import { runRuntimeSignalSessions } from "../features/ttsc/ttsx-runtime/test_ttsx_forwards_termination_signals_and_cleans_up_on_posix";
import { STANDARD_DECORATOR_OUTPUT } from "../internal/ttsc/internal/ttsx-decorators";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Retain irreducible Node startup and terminal contracts on one staged graph.
 *
 * The existing JavaScript-main register actor hosts actual Mocha over three
 * excluded checked TypeScript roots in two owning projects before its ordinary
 * dependency load. Literal suite results, exact three live generations and
 * post-exit empty index/no nested node_modules preserve coexistence and
 * cleanup. Mocha 12's public default export, addFile, run, pass event and
 * actual stats are used; no callback or framework success is fabricated. There
 * is no extra Node actor, but three real checked root preparations are
 * additional work.
 *
 * Two short CLI admission actors share the upfront response-watch fixture.
 * Nested false and UTF16 watch requests must fail from the selected project
 * directory before resolving the intentionally absent compiler or acquiring
 * cache state. Portable response semantics remain in the source units.
 *
 * @evidence contracts/testing.md#behavioral-verification Real installed public register and CLI children preserve CommonJS main/native cache/prefix-only builtins/typed dependency, ESM SQLite, JavaScript main under import preload with exact tail argv, handled exception survival and actual exit7/throw1/rejection1 statuses.
 * @evidence contracts/testing.md#independent-expectations Authored dep+leaf, main/cache booleans, UUID36, SQLite-close completion, exact forwarded tokens and literal OS statuses are independent of product outputs. Original input bytes and actual synchronous child closure are checked.
 * @evidence contracts/testing.md#distinguishing-cases Import-register and import-preload plus require-register are distinct startup modes. Typed CommonJS and ESM entry ownership differ from JavaScript main requiring TypeScript; handled continuation contrasts with three terminal outcomes. Installed owner preload separately distinguishes an existing inherited run, a removed inherited run and manifestless independent startup.
 * @evidence contracts/testing.md#execution-ownership One Runtime DAG body owns ten additional real launcher lifetimes: four direct Node/register startup modes, one handled-exception CLI, three terminal CLIs and two response-watch admission CLIs. Four CLI launchers also start their actual entry children, so these are at least fourteen Node lifetimes, with further native preparation work still delegated and uncounted here. The response admission actors require no entry child or compiler. Fatal exits and preload selection require separate lifetimes; no child is created per source or builtin. No one-Program or zero-cost claim is made.
 * @evidence contracts/e2e.md#necessary-boundary Native Node preload/main dispatch, register hooks, SQLite module loading and terminal statuses cannot be established by argument classification or cached source units. A static first-user program requires its actual hostname/PID owner record before writing the marker; removed-run startup must fail without that marker, whereas the empty-manifest child must execute independently.
 * @evidence contracts/e2e.md#shared-execution All ten launcher requests and their actual entry children use the upfront staged graph and installed SDK. The two admission requests share their separate response fixture and absent cache path without native preparation. Compatible builtin/dependency assertions are combined in each startup; terminal and startup-mode lifetimes remain explicitly separate. The three owner-preload environment transitions add three actual Node lifetimes using the same installed SDK and project; they neither install another fixture nor build another native contributor.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each synchronous spawn owns a real status/signal/PID receipt and joins closure before the next. Runtime ownership environment inherited from unrelated actors is removed. Source bytes remain unchanged; unresolved closure blocks later shared reuse. Independent case failures are collected.
 * @evidence contracts/e2e.md#preserved-coverage Restores baseline selected native main/fatal/register/import-preload/JavaScript/ESM builtin meanings with one upfront island instead of per-case fixtures. On POSIX the same owning signal helper adds three real detached launcher/entry sessions for handled SIGTERM, unhandled SIGTERM and exactly-once group SIGINT with all three empty runtime-index assertions; Windows supplies no POSIX coverage. Those six additional Node lifetimes and repeated native checks remain costs. The same handled CLI carries all four require spellings, scoped/subpath preloads, typed TS/TSX outside include, exact preload order and post-entry option tokens. A separate mistyped preload must reject before main; that irreducible failed-startup actor adds at least one launcher and potentially an entry child, with native costs unmeasured. Existing fatal actors also carry constant-source orphan enum/package-format transitions. Separately seeded stale generations use the preceding actually joined actor PID and a fresh ESRCH/hostname proof; real register startup and real ttsx startup must each sweep their own seed. No extra PID-establishing child is added. An overall single-digit process budget remains uncertified.
 */
export async function runtimeFrontdoorsCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/runtime-frontdoors");
  const register = path.resolve(
    path.dirname(workspace.installedTtsx),
    "../register.js",
  );
  const preload = pathToFileURL(path.join(root, "preload.mjs")).href;
  const sources = [
    "main.cjs",
    "src/main.ts",
    "src/dep.ts",
    "src/leaf.ts",
    "src/esm.mts",
    "src/exit.ts",
    "src/throws.ts",
    "src/rejects.mts",
    "src/handled.ts",
  ].map((name) => path.join(root, name));
  const original = sources.map((file) => fs.readFileSync(file));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TTSC_CACHE_DIR: workspace.cache,
  };
  for (const name of [
    "TTSX_RUNTIME_MANIFEST",
    "TTSX_RUNTIME_CACHE_DIR",
    "TTSX_RUNTIME_RUN_DIR",
    "TTSX_RUNTIME_RUNS_DIR",
  ])
    delete env[name];
  const failures: unknown[] = [];
  let ownershipUnresolved = false;
  let lastDepartedPid: number | undefined;
  const plantDepartedGeneration = (name: string) => {
    if (ownershipUnresolved || lastDepartedPid === undefined)
      throw new Error(
        "no resolved departed runtime actor owns the stale-generation seed",
      );
    try {
      process.kill(lastDepartedPid, 0);
      throw new Error(
        "the preceding runtime actor PID is no longer provably gone",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    const directory = path.join(workspace.cache, "ttsx/project", name);
    assert.equal(fs.existsSync(directory), false);
    fs.mkdirSync(path.join(directory, "fs"), { recursive: true });
    fs.writeFileSync(
      path.join(directory, `owner-${lastDepartedPid}.json`),
      JSON.stringify({ hostname: os.hostname(), pid: lastDepartedPid }),
    );
    fs.writeFileSync(path.join(directory, "fs/main.js"), "");
    return directory;
  };
  const orphanRoot = path.join(root, "node_modules/runtime-cache-control");
  const orphanEntry = path.join(orphanRoot, "src/index.ts");
  const orphanEnum = path.join(orphanRoot, "src/enum.ts");
  const orphanManifest = path.join(orphanRoot, "package.json");
  const orphanEntryBytes = fs.readFileSync(orphanEntry);
  const orphanEnumBytes = fs.readFileSync(orphanEnum);
  const orphanManifestBytes = fs.readFileSync(orphanManifest);
  const orphanPreload = path.join(root, "orphan-preload.cjs");
  const stageOrphan = (type: string, answer: number) => {
    if (ownershipUnresolved)
      throw new Error(
        "orphan inputs remain owned by an unresolved runtime actor",
      );
    fs.writeFileSync(
      orphanManifest,
      JSON.stringify({
        name: "runtime-cache-control",
        type,
        exports: "./src/index.ts",
      }),
    );
    fs.writeFileSync(
      orphanEnum,
      `export const enum Value { Entry = ${answer} }\n`,
    );
  };
  const assertOrphan = (
    stdout: string,
    answer: number,
    tail: readonly string[],
  ) => {
    assert.deepEqual(stdout.trim().split(/\r?\n/), [
      ...STANDARD_DECORATOR_OUTPUT.split(/\r?\n/),
      "TTSC_ORPHAN_ANSWER:" + answer,
      ...tail,
    ]);
    assert.deepEqual(
      fs.readFileSync(orphanEntry),
      orphanEntryBytes,
      "decorated source must stay byte-identical across imported values and package formats",
    );
  };
  const run = (args: string[], actorEnv: NodeJS.ProcessEnv = env) => {
    if (ownershipUnresolved)
      throw new Error("runtime actor cannot reuse unresolved input ownership");
    const result = E2eProcessTrace.spawnSync(process.execPath, args, {
      cwd: root,
      env: actorEnv,
      encoding: "utf8",
      windowsHide: true,
    });
    if (!isOrdinarilyClosedReadonlyLauncher(result)) {
      ownershipUnresolved = true;
      BatchWorkspace.retain(
        "native runtime frontdoor closure remained unresolved",
      );
      throw new Error("native runtime frontdoor closure remained unresolved", {
        cause:
          result.error ??
          new Error(
            JSON.stringify({
              pid: result.pid,
              status: result.status,
              signal: result.signal,
            }),
          ),
      });
    }
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    try {
      process.kill(result.pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        lastDepartedPid = result.pid;
        return result;
      }
      BatchWorkspace.retain(
        "runtime frontdoor PID closure could not be observed",
      );
      ownershipUnresolved = true;
      throw error;
    }
    BatchWorkspace.retain(
      "runtime frontdoor PID remained live after synchronous return",
    );
    ownershipUnresolved = true;
    throw new Error(
      "runtime frontdoor PID remained live after synchronous return",
    );
  };
  const capture = (name: string, body: () => void): void => {
    try {
      body();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  try {
    await case_ttsx_response_watch_refusal(path.join(root, "response-watch"), {
      launcher: workspace.installedTtsx,
    });
  } catch (cause) {
    failures.push(new Error("response watch CLI admission", { cause }));
  }
  const typed = {
    main: true,
    cache: "object",
    shared: true,
    dep: "dep+leaf",
    prefix: true,
    cryptoLength: 36,
  };
  for (const [name, args] of [
    [
      "import-register typed main",
      ["--import", pathToFileURL(register).href, "src/main.ts"],
    ],
    [
      "import-preload require-register typed main",
      ["--import", preload, "-r", register, "src/main.ts"],
    ],
  ] as const)
    capture(name, () => {
      const stale =
        name === "import-preload require-register typed main"
          ? plantDepartedGeneration("ended-register-run")
          : undefined;
      const result = run([...args]);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), typed);
      if (stale !== undefined)
        assert.equal(
          fs.existsSync(stale),
          false,
          "actual register preparation must sweep its separately seeded departed owner",
        );
    });
  capture("JavaScript main under import preload", () => {
    const result = run([
      "--import",
      preload,
      "-r",
      register,
      "main.cjs",
      "--config",
      "x",
      "--help",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      main: true,
      value: "dep+leaf",
      argv: ["--config", "x", "--help"],
      roots: { passes: 3, names: ["first", "second", "third"], coexist: 3 },
    });
    const runtimeIndex = path.join(workspace.cache, "ttsx/project");
    assert.deepEqual(
      fs.existsSync(runtimeIndex) ? fs.readdirSync(runtimeIndex) : [],
      [],
      "the three checked roots release after the actual Mocha host exits",
    );
    for (const name of ["one", "two"])
      assert.equal(
        fs.existsSync(path.join(root, name, "node_modules")),
        false,
        "checked roots must not create nested node_modules",
      );
  });
  capture("ESM register SQLite", () => {
    const result = run(["--require", register, "src/esm.mts"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      kind: "esm",
      sqlite: "esm-sqlite-ok",
    });
  });
  capture("handled uncaught exception", () => {
    const stale = plantDepartedGeneration("ended-ttsx-run");
    stageOrphan("module", 1);
    const result = run([
      workspace.installedTtsx,
      "--no-plugins",
      "-r",
      orphanPreload,
      "--require=./a.ts",
      "-r=./a.cjs",
      "-r",
      "./c.tsx",
      "--require",
      "./b.cjs",
      "-r",
      "@scope/preload",
      "--require",
      "plain-preload/register",
      "src/handled.ts",
      "--",
      "generate",
      "--help",
      "--version",
      "--watch",
      "--build",
      "-r",
      "./after.cjs",
      "--",
      "b",
    ]);
    capture("handled actor status", () =>
      assert.equal(result.status, 0, result.stderr),
    );
    capture("ttsx startup sweeps a genuinely departed owner", () =>
      assert.equal(fs.existsSync(stale), false),
    );
    capture("handled actor orphan, preloads and continuation", () => {
      const observations = result.stdout
        .split(/\r?\n/)
        .filter((line) => line.startsWith("TTSC_HANDLED_PRELOADS:"));
      assert.equal(observations.length, 1);
      const observed = JSON.parse(
        observations[0]!.slice("TTSC_HANDLED_PRELOADS:".length),
      ) as {
        cwd: string;
        preload: unknown;
        scoped: unknown;
        subpath: unknown;
        argv: unknown;
      };
      assert.equal(
        fs.realpathSync.native(observed.cwd),
        fs.realpathSync.native(root),
      );
      const expected = {
        preload: "loaded",
        scoped: "scoped",
        subpath: "subpath",
        argv: [
          "generate",
          "--help",
          "--version",
          "--watch",
          "--build",
          "-r",
          "./after.cjs",
          "--",
          "b",
        ],
      };
      const { cwd, ...preloads } = observed;
      assert.deepEqual(preloads, expected);
      assertOrphan(result.stdout, 1, [
        "PRELOAD a.ts",
        "PRELOAD a.cjs",
        "PRELOAD c.tsx",
        "PRELOAD b.cjs",
        "TTSC_HANDLED_PRELOADS:" + JSON.stringify({ ...expected, cwd }),
        "handled: boom",
        "still alive",
      ]);
    });
    capture("post-entry require remains a script token", () =>
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /UNEXPECTED POST-ENTRY PRELOAD|entry file is required|Unknown compiler option/i,
      ),
    );
  });
  for (const [name, status, message, type, answer] of [
    ["exit.ts", 7, undefined, "module", 2],
    ["throws.ts", 1, /unhandled runtime frontdoor/, "commonjs", 3],
    ["rejects.mts", 1, /rejected runtime frontdoor/, "commonjs", 4],
  ] as const)
    capture(name, () => {
      stageOrphan(type, answer);
      const result = run([
        workspace.installedTtsx,
        "--no-plugins",
        "-r",
        orphanPreload,
        "src/" + name,
      ]);
      capture(name + " status", () =>
        assert.equal(result.status, status, result.stderr),
      );
      if (message !== undefined)
        capture(name + " stderr", () => assert.match(result.stderr, message));
      capture(name + " orphan cache", () =>
        assertOrphan(result.stdout, answer, []),
      );
    });
  capture("mistyped preload outside include rejects before entry", () => {
    const result = run([
      workspace.installedTtsx,
      "--no-plugins",
      "-r",
      "./invalid-preload.ts",
      "src/handled.ts",
    ]);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /root check failed for .*invalid-preload\.ts/);
    assert.match(
      result.stderr,
      /Type 'string' is not assignable to type 'number'/,
    );
    assert.doesNotMatch(
      result.stdout,
      /TTSC_HANDLED_PRELOADS|handled: boom|still alive|INVALID_PRELOAD_RAN/,
    );
  });
  // Startup admission must precede user code; its three environment states
  // require separate Node lifetimes but reuse this staged project and SDK.
  const ownerRun = path.join(
    workspace.cache,
    "ttsx/project/owner-preload-contract",
  );
  const ownerMarker = path.join(root, "owner-preload-marker");
  const ownerPreload = path.join(
    path.dirname(workspace.installedTtsx),
    "internal/runtimeOwnerPreload.js",
  );
  const ownerEnv = {
    ...env,
    NODE_OPTIONS: "",
    TTSC_OWNER_PRELOAD_MARKER: ownerMarker,
    TTSX_RUNTIME_MANIFEST: path.join(ownerRun, "runtime-manifest.json"),
    TTSX_RUNTIME_CACHE_DIR: path.join(workspace.cache, "ttsx"),
    TTSX_RUNTIME_RUNS_DIR: path.dirname(ownerRun),
    TTSX_RUNTIME_RUN_DIR: ownerRun,
  };
  let ownerRunRemoved = false;
  capture("owner preload admission is visible before user code", () => {
    assert.equal(fs.existsSync(ownerRun), false);
    assert.equal(fs.existsSync(ownerMarker), false);
    fs.mkdirSync(ownerRun, { recursive: true });
    fs.writeFileSync(ownerEnv.TTSX_RUNTIME_MANIFEST, "{}");
    const result = run(
      ["-r", ownerPreload, "owner-preload-program.cjs"],
      ownerEnv,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      "TTSC_OWNER_PRELOAD:claimed-before-user",
    );
    assert.equal(fs.readFileSync(ownerMarker, "utf8"), "claimed-before-user");
  });
  capture("owner preload removed-run startup fails before user code", () => {
    if (ownershipUnresolved)
      throw new Error("owner preload run remains owned by an unresolved child");
    assert.equal(
      path.dirname(ownerRun),
      path.join(workspace.cache, "ttsx/project"),
    );
    fs.rmSync(ownerRun, { recursive: true, force: true });
    fs.rmSync(ownerMarker, { force: true });
    ownerRunRemoved = true;
    const result = run(
      ["-r", ownerPreload, "owner-preload-program.cjs"],
      ownerEnv,
    );
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(fs.existsSync(ownerMarker), false, result.stderr);
    assert.doesNotMatch(result.stdout, /TTSC_OWNER_PRELOAD:/);
  });
  capture(
    "owner preload manifestless startup is independent of the removed run",
    () => {
      assert.equal(
        ownerRunRemoved,
        true,
        "the missing-run transition must have completed",
      );
      assert.equal(fs.existsSync(ownerRun), false);
      assert.equal(fs.existsSync(ownerMarker), false);
      const result = run(["-r", ownerPreload, "owner-preload-program.cjs"], {
        ...ownerEnv,
        TTSX_RUNTIME_MANIFEST: "",
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "TTSC_OWNER_PRELOAD:independent");
      assert.equal(fs.readFileSync(ownerMarker, "utf8"), "independent");
      assert.equal(fs.existsSync(ownerRun), false);
    },
  );
  if (!ownershipUnresolved)
    for (const [file, bytes] of [
      [orphanEnum, orphanEnumBytes],
      [orphanManifest, orphanManifestBytes],
    ] as const)
      capture("restore orphan input " + file, () => {
        try {
          fs.writeFileSync(file, bytes);
        } catch (error) {
          ownershipUnresolved = true;
          BatchWorkspace.retain(
            "orphan input restoration failed after actual closures",
          );
          throw error;
        }
      });
  for (let index = 0; index < sources.length; index++)
    capture("immutable " + sources[index], () =>
      assert.deepEqual(fs.readFileSync(sources[index]!), original[index]),
    );
  if (process.platform !== "win32" && !ownershipUnresolved) {
    let pending = 0;
    try {
      await runRuntimeSignalSessions(
        path.join(root, "signals"),
        () => {
          pending++;
          return () => {
            pending--;
          };
        },
        workspace.installedTtsx,
        {
          TTSC_CACHE_DIR: undefined,
          TTSC_BINARY: undefined,
          TTSC_TSGO_BINARY: undefined,
        },
      );
    } catch (error) {
      failures.push(
        new Error("native POSIX signal sessions", { cause: error }),
      );
    } finally {
      if (pending !== 0)
        BatchWorkspace.retain(
          "native signal session closure remained unresolved",
        );
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "native runtime startup and terminal corpus failed",
    );
}
