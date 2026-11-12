import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies persistent runtime emits across independent Node processes over a
 * pnpm-shaped graph whose package exports point directly at TypeScript source.
 *
 * 1. Share the installed compiler and author two linked source packages.
 * 2. Compare cold, warm and bypassed execution under original source identities.
 * 3. Edit a cross-package const enum, reject a type error, repair it, and damage
 *    persisted documents before another successful execution.
 *
 * @evidence contracts/testing.md#behavioral-verification Real installed ttsx processes print actual package values, cwd, filenames, entry/main identity, adjacent asset bytes and a caught source-mapped stack in CommonJS and ESM. Product trace events distinguish recorded/reused generations, one materialized bundle and zero source-content reads for an unchanged proof. Warm execution has no native emit, lint check or transform command, including combined lint/evidence/banner execution; bypass still emits. Changing only model.ts produces TS2322 in unchanged consumer.ts and blocks execution; dependency, membership, package-export and native config changes are separately exercised. Concurrent cold publishers both execute the correct program.
 * @evidence contracts/testing.md#independent-expectations Authored enum literals 7/11, adjacent asset text, actual filesystem source paths and the authored throw line determine expected behavior independently of stored documents or compiler output. Producer argv and trace outcomes are actual observations.
 * @evidence contracts/testing.md#distinguishing-cases Cold/warm/bypass, a warm run under other program arguments and unread environment variables, the authored files' unchanged link count and stamps across runs, a plugin project proven without starting the compiler, dependency-only edits, type failure/repair, corrupt storage and dynamic excluded roots contrast success reuse with required recompilation. Both linked packages export src and a non-imported root remains checked.
 * @evidence contracts/testing.md#execution-ownership The Runtime batch invokes this helper using its existing installed SDK and cache owner. Independent launcher lifetimes prove persistence and input transitions; linked banner and combined lint/evidence/banner compositions borrow the installed contributors, with no extra installation.
 * @evidence contracts/e2e.md#necessary-boundary Cross-process persistence, native compiler invocation, source-linked package resolution and actual Node source identity cannot be established by a document-store unit.
 * @evidence contracts/e2e.md#shared-execution One upfront graph shares two workspace package owners and all identity/map assertions across the necessary state transitions. The installed banner contributor adds one linked-host composition, prepared by its native bypass run before the completed-result cold/warm pair and config edit. A separate ESM request supplies native module URL/main/resource evidence across cold/warm/bypass. Native source-selection probes remain real work even on a hit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Child environments clear the harness compiler override so package discovery selects the installed consumer's compiler. Every ordinary synchronous launcher is joined and its PID checked before input mutation. Unresolved ownership retains the batch graph and stops transitions. The batch owns cleanup; package junctions remain within its authored graph. One precreated trace sink serves every run; reporting switches are not part of a cache identity.
 * @evidence contracts/e2e.md#preserved-coverage Adds a real warm-generation neighbor to existing fresh runtime coverage without deleting or retargeting previous cases. All state assertions collect before the final verdict; CI owns the full Runtime batch.
 */
export async function runtimePersistentCacheCorpus(
  workspace: Pick<BatchWorkspace.Workspace, "root" | "cache" | "installedTtsx">,
): Promise<void> {
  const root = path.join(workspace.root, "tools/runtime-persistent");
  const write = (name: string, text: string): void => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const common = {
    target: "es2022",
    module: "commonjs",
    strict: true,
    types: [],
  };
  write("package.json", '{"name":"runtime-persistent","private":true}');
  write("pnpm-workspace.yaml", "packages:\n  - packages/*\n  - test\n");
  write(
    "test/tsconfig.json",
    JSON.stringify({
      compilerOptions: { ...common, rootDir: "..", noEmit: true },
      include: ["src"],
    }),
  );
  write(
    "test/package.json",
    '{"name":"runtime-persistent-test","private":true}',
  );
  for (const name of ["a", "b"]) {
    write(
      `packages/${name}/package.json`,
      JSON.stringify({
        name: `runtime-persistent-${name}`,
        main: "./src/index.ts",
        exports: "./src/index.ts",
      }),
    );
    write(
      `packages/${name}/tsconfig.json`,
      JSON.stringify({
        compilerOptions: { ...common, rootDir: "src" },
        include: ["src"],
      }),
    );
  }
  write(
    "packages/a/src/enum.ts",
    "export const enum NumberValue { Current = 7 }\n",
  );
  write(
    "packages/a/src/index.ts",
    "import { NumberValue } from './enum'; export const value = NumberValue.Current;\n",
  );
  write(
    "packages/b/src/index.ts",
    "import { value } from 'runtime-persistent-a'; export const result = value + 1;\n",
  );
  write("test/src/unused.ts", "export const checked: number = 1;\n");
  write("test/src/model.ts", "export interface Shape { value: number }\n");
  write(
    "test/src/consumer.ts",
    "import type { Shape } from './model'; export const checked: Shape = { value: 1 };\n",
  );
  write("test/src/asset.txt", "adjacent-source-asset");
  write("test/src/late.ts", "export const late = 19;\n");
  write(
    "test/src/main.ts",
    [
      "declare const require: any, module: any, process: any, __filename: string, __dirname: string;",
      "import { result } from 'runtime-persistent-b';",
      "let stack = '';",
      "try { throw new Error('source-coordinate'); } catch (error) { stack = (error as Error).stack!; }",
      "console.log(JSON.stringify({ result, cwd:process.cwd(), file:__filename, dir:__dirname, argv:process.argv[1], main:require.main === module, asset:require('node:fs').readFileSync(require('node:path').join(__dirname,'asset.txt'),'utf8'), stack }));",
    ].join("\n"),
  );
  const modules = path.join(root, "node_modules");
  fs.mkdirSync(modules, { recursive: true });
  for (const name of ["a", "b"])
    fs.symlinkSync(
      fs.realpathSync.native(path.join(root, "packages", name)),
      path.join(modules, "runtime-persistent-" + name),
      "junction",
    );
  const trace = path.join(
    process.env.TTSC_E2E_TRACE ?? workspace.cache,
    "runtime-persistent-trace",
  );
  fs.mkdirSync(trace, { recursive: true });
  const cache = path.join(workspace.cache, "runtime-persistent-store");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TTSC_CACHE_DIR: cache,
    TTSC_E2E_TRACE: trace,
    TTSC_EXPLAIN_CACHE: "1",
    // The harness seeds its workspace compiler for in-process unplugin tests.
    // This experiment exercises the consumer's own installed compiler instead.
    TTSC_TSGO_BINARY: undefined,
  };
  for (const key of Object.keys(env))
    if (/^TTSX_RUNTIME_/i.test(key) || key === "TTSX_DISABLE_CACHE")
      delete env[key];
  const events = (): any[] =>
    fs
      .readdirSync(trace)
      .filter((name) => name.endsWith(".jsonl"))
      .flatMap((name) =>
        fs
          .readFileSync(path.join(trace, name), "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      );
  const failures: unknown[] = [];
  const check = (body: () => void): void => {
    try {
      body();
    } catch (error) {
      failures.push(error);
    }
  };
  let unresolved = false;
  const run = (
    flags: string[] = [],
    expected = 8,
    succeeds = true,
    errorFile?: string,
    entry = "src/main.ts",
    errorPattern = /TS2322/,
    invocation: { args?: string[]; env?: NodeJS.ProcessEnv } = {},
  ): any[] => {
    if (unresolved)
      throw new Error("preceding cache actor ownership unresolved");
    const before = new Set(events().map((event) => JSON.stringify(event)));
    const cwd = fs.realpathSync.native(path.join(root, "test"));
    const result = E2eProcessTrace.spawnSync(
      process.execPath,
      [workspace.installedTtsx, ...flags, entry, ...(invocation.args ?? [])],
      {
        cwd,
        env: { ...env, ...invocation.env },
        encoding: "utf8",
        windowsHide: true,
      },
    );
    if (!isOrdinarilyClosedReadonlyLauncher(result)) {
      unresolved = true;
      BatchWorkspace.retain("persistent cache actor closure unresolved");
      throw new Error("persistent cache actor closure unresolved", {
        cause: result.error,
      });
    }
    try {
      process.kill(result.pid, 0);
      unresolved = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        unresolved = true;
      }
    }
    if (unresolved) {
      BatchWorkspace.retain("persistent cache actor PID departure unresolved");
      throw new Error("persistent cache actor PID departure unresolved");
    }
    check(() =>
      assert.equal(
        result.status === 0,
        succeeds,
        result.stdout + result.stderr,
      ),
    );
    if (succeeds && result.status === 0)
      check(() => {
        assert.match(result.stderr, /ttsx cache: /);
        const observed = JSON.parse(result.stdout.trim());
        const file = fs.realpathSync.native(path.join(root, "test", entry));
        assert.deepEqual(
          { ...observed, stack: undefined },
          {
            result: expected,
            cwd,
            file,
            dir: path.dirname(file),
            argv: file,
            main: true,
            asset: "adjacent-source-asset",
            stack: undefined,
            ...(entry.endsWith(".mts")
              ? { url: pathToFileURL(file).href }
              : {}),
          },
        );
        assert.match(observed.stack, /main\.[m]?ts:4:\d+/);
      });
    if (!succeeds)
      check(() => {
        assert.equal(result.stdout.includes('"result"'), false);
        assert.match(result.stderr, errorPattern);
        if (errorFile !== undefined)
          assert.ok(result.stderr.includes(errorFile), result.stderr);
      });
    return events()
      .filter((event) => !before.has(JSON.stringify(event)))
      .map((event) => ({ ...event, launcher: event.writerPid === result.pid }));
  };
  const outcomes = (
    records: any[],
    outcome: string,
    launcherOnly = false,
  ): any[] =>
    records.filter(
      (event) =>
        event.event === "capability-resolution" &&
        event.data?.phase === "runtime-build-cache" &&
        event.data.outcome === outcome &&
        (!launcherOnly || event.launcher),
    );
  const emitting = (records: any[]): any[] =>
    records.filter(
      (event) =>
        event.event === "process-attempt" &&
        !event.argv?.includes("--showConfig") &&
        !event.argv?.includes("--listFilesOnly") &&
        event.argv?.some(
          (arg: string) =>
            arg === "--listEmittedFiles" ||
            arg === "--emit-provenance-json" ||
            arg.startsWith("--emit-provenance-json="),
        ),
    );
  // A run must leave the metadata of the user's own files as it found it:
  // linking one into a private layout moved its change time and link count,
  // which every metadata proof of that file reads (samchon/ttsc#1852).
  const authored = [
    "test/package.json",
    "test/tsconfig.json",
    "test/src/asset.txt",
    "package.json",
  ].map((name) => path.join(root, name));
  const metadata = (): string =>
    JSON.stringify(
      authored.map((file) => {
        const stat = fs.statSync(file, { bigint: true });
        return [String(stat.nlink), String(stat.mtimeNs), String(stat.ctimeNs)];
      }),
    );
  const untouched = metadata();
  // Compiler queries by any process of the run: the launcher proves the
  // entry project and the program's own process proves each dependency.
  const queries = (records: any[], flag: string): any[] =>
    records.filter(
      (event) =>
        event.event === "process-attempt" && event.argv?.includes(flag),
    );
  const cold = run();
  check(() => assert.equal(metadata(), untouched));
  const warm = run();
  check(() => assert.equal(metadata(), untouched));
  // The program's own arguments and variables no build process reads are not
  // inputs of a compile: a package manager exports the former into the
  // environment, and a key over all of it missed on every invocation.
  const noise = run([], 8, true, undefined, "src/main.ts", /TS2322/, {
    args: ["--list", "--port=3000"],
    env: {
      npm_lifecycle_script: "ttsx src/main.ts --list --port=3000",
      E2E_UNREAD_VARIABLE: String(process.pid),
    },
  });
  check(() => {
    assert.ok(outcomes(noise, "reused", true).length > 0);
    assert.equal(outcomes(noise, "recorded").length, 0);
    assert.equal(emitting(noise).length, 0);
  });
  const bypass = run(["--no-cache"]);
  check(() => {
    assert.ok(outcomes(cold, "recorded").length > 0);
    assert.ok(outcomes(warm, "reused").length > 0);
    assert.ok(outcomes(warm, "reused", true).length > 0);
    assert.ok(
      outcomes(warm, "reused").every((event) => event.data.materialized === 1),
    );
    // Every proof of the unchanged run, not merely one of them, must stand on
    // metadata alone, and the configuration is not asked for a second time.
    const contents = warm.filter(
      (event) => event.data?.phase === "runtime-input-content",
    );
    assert.ok(contents.length > 0);
    assert.ok(
      contents.every(
        (event) => event.data.contentReads === 0 && event.data.inputs > 0,
      ),
      JSON.stringify(contents.map((event) => event.data)),
    );
    // A warm run proves every project by replaying what tsc reported when it
    // built them, so it starts no compiler at all.
    assert.equal(queries(warm, "--showConfig").length, 0);
    assert.equal(queries(warm, "--listFilesOnly").length, 0);
    assert.equal(emitting(warm).length, 0);
    assert.equal(outcomes(bypass, "reused").length, 0);
    assert.ok(emitting(bypass).length > 0);
  });
  write(
    "packages/a/src/enum.ts",
    "export const enum NumberValue { Current = 11 }\n",
  );
  run([], 12);
  write("test/src/model.ts", "export interface Shape { value: string }\n");
  run([], 12, false, "consumer.ts");
  write("test/src/model.ts", "export interface Shape { value: number }\n");
  run([], 12);
  write("test/src/unused.ts", "export const checked: number = 'invalid';\n");
  run([], 12, false);
  write("test/src/unused.ts", "export const checked: number = 1;\n");
  run([], 12);
  write("test/src/added.ts", "export const added: number = 'invalid';\n");
  run([], 12, false);
  fs.unlinkSync(path.join(root, "test/src/added.ts"));
  run([], 12);
  const packageFile = path.join(root, "packages/a/package.json");
  const packageBytes = fs.readFileSync(packageFile);
  write("packages/a/src/alternative.ts", "export const value = 31;\n");
  write(
    "packages/a/package.json",
    JSON.stringify({
      name: "runtime-persistent-a",
      main: "./src/alternative.ts",
      exports: "./src/alternative.ts",
    }),
  );
  run([], 32);
  fs.writeFileSync(packageFile, packageBytes);
  fs.unlinkSync(path.join(root, "packages/a/src/alternative.ts"));
  run([], 12);
  const documents = path.join(cache, "runtime-builds");
  check(() =>
    assert.ok(
      fs.readdirSync(documents).some((name) => name.endsWith(".json")),
      "no persistent document to damage",
    ),
  );
  for (const name of fs.readdirSync(documents))
    if (name.endsWith(".json"))
      fs.writeFileSync(path.join(documents, name), "invalid-cache-document");
  const concurrent = await Promise.all(
    [0, 1].map(
      () =>
        new Promise<{
          code: number | null;
          signal: NodeJS.Signals | null;
          stdout: string;
          stderr: string;
          error?: Error;
          pid?: number;
        }>((resolve) => {
          const child = E2eProcessTrace.spawn(
            process.execPath,
            [workspace.installedTtsx, "src/main.ts"],
            {
              cwd: path.join(root, "test"),
              env,
              windowsHide: true,
              stdio: ["ignore", "pipe", "pipe"],
            },
          );
          let stdout = "",
            stderr = "",
            error: Error | undefined;
          child.stdout!.setEncoding("utf8").on("data", (text: string) => {
            stdout += text;
          });
          child.stderr!.setEncoding("utf8").on("data", (text: string) => {
            stderr += text;
          });
          child.on("error", (value) => {
            error = value;
          });
          child.on("close", (code, signal) =>
            resolve({ code, signal, stdout, stderr, error, pid: child.pid }),
          );
        }),
    ),
  );
  for (const result of concurrent) {
    if (
      result.error ||
      result.signal !== null ||
      result.code === null ||
      result.pid === undefined
    ) {
      unresolved = true;
      BatchWorkspace.retain("concurrent cache actor closure unresolved");
      throw new Error("concurrent cache actor closure unresolved", {
        cause: result.error,
      });
    }
    try {
      process.kill(result.pid, 0);
      unresolved = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") unresolved = true;
    }
    if (unresolved) {
      BatchWorkspace.retain("concurrent cache actor PID departure unresolved");
      throw new Error("concurrent cache actor PID departure unresolved");
    }
    check(() => {
      assert.equal(result.code, 0, result.stdout + result.stderr);
      assert.equal(JSON.parse(result.stdout.trim()).result, 12);
    });
  }
  run([], 12);
  // Add an excluded dynamic root after the stable generation exists. The
  // existing checked single-root fallback must still compile it on both runs.
  write("test/outside.ts", "export const late = 23;\n");
  const main = fs.readFileSync(path.join(root, "test/src/main.ts"), "utf8");
  write(
    "test/src/main.ts",
    main.replace(
      "result, cwd:",
      "result:result + require('../outside.ts').late, cwd:",
    ),
  );
  run([], 35);
  run([], 35);
  write("test/src/main.ts", main);
  write("test/banner.config.json", '{"text":"persistent-native-transform"}');
  write(
    "test/tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        ...common,
        rootDir: "..",
        noEmit: true,
        plugins: [
          { transform: "@ttsc/banner", configFile: "./banner.config.json" },
        ],
      },
      include: ["src"],
    }),
  );
  run(["--no-cache"], 12);
  const nativeCold = run([], 12);
  const nativeWarm = run([], 12);
  check(() => assert.ok(outcomes(nativeCold, "recorded", true).length > 0));
  check(() => assert.ok(outcomes(nativeWarm, "reused", true).length > 0));
  check(() => assert.equal(emitting(nativeWarm).length, 0));
  // A native host reports every question its compiler asked, so the stored
  // result is proven by replaying those answers: the launcher starts no
  // compiler at all to ask for its source selection.
  check(() => {
    assert.equal(queries(nativeWarm, "--listFilesOnly").length, 0);
    assert.equal(queries(nativeWarm, "--showConfig").length, 0);
  });
  // A plugin that has not declared its environment reads may read any
  // variable directly, so its project stays keyed by the complete environment:
  // an unread variable builds it again rather than risking a stale emit.
  const nativeNoise = run([], 12, true, undefined, "src/main.ts", /TS2322/, {
    env: { E2E_UNREAD_VARIABLE: String(process.pid) },
  });
  check(() => {
    assert.equal(outcomes(nativeNoise, "reused", true).length, 0);
    assert.ok(outcomes(nativeNoise, "recorded", true).length > 0);
  });
  const served = (records: any[]): string =>
    records
      .filter(
        (event) =>
          event.event === "runtime-source-preparation" &&
          event.data?.source?.path,
      )
      .map((event) =>
        fs
          .readFileSync(path.join(trace, event.data.source.path))
          .toString("utf16le"),
      )
      .join("\n");
  check(() => {
    assert.match(served(nativeCold), /persistent-native-transform/);
    assert.match(served(nativeWarm), /persistent-native-transform/);
  });
  write("test/banner.config.json", '{"text":"changed-native-transform"}');
  const nativeChanged = run([], 12);
  check(() => assert.ok(outcomes(nativeChanged, "recorded", true).length > 0));
  check(() => assert.match(served(nativeChanged), /changed-native-transform/));
  // Keep a real check contributor and transform in the same cached pipeline.
  // The existing installation already owns lint/evidence and the banner host.
  write(
    "test/lint.config.ts",
    "import { evidence } from '@ttsc/evidence'; export default { plugins: { evidence }, rules: { 'evidence/todo': 'error' } };\n",
  );
  write(
    "test/tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        ...common,
        rootDir: "..",
        noEmit: true,
        plugins: [
          { transform: "@ttsc/lint", configFile: "./lint.config.ts" },
          { transform: "@ttsc/banner", configFile: "./banner.config.json" },
        ],
      },
      include: ["src"],
    }),
  );
  const checkedCold = run([], 12);
  const checkedWarm = run([], 12);
  const cacheDecisions = (records: any[]): string =>
    JSON.stringify(
      records
        .filter((event) => event.data?.phase === "runtime-build-cache")
        .map((event) => event.data),
    );
  check(() =>
    assert.ok(
      outcomes(checkedCold, "recorded", true).length > 0,
      cacheDecisions(checkedCold),
    ),
  );
  check(() =>
    assert.ok(
      outcomes(checkedWarm, "reused", true).length > 0,
      cacheDecisions(checkedWarm),
    ),
  );
  check(() => assert.equal(emitting(checkedWarm).length, 0));
  check(() =>
    assert.equal(
      checkedWarm.filter(
        (event) =>
          event.event === "process-attempt" && event.argv?.includes("check"),
      ).length,
      0,
    ),
  );
  check(() => assert.match(served(checkedWarm), /changed-native-transform/));
  write(
    "test/src/lint-sentinel.ts",
    "/** @todo authored pending work */ export const lintSentinel = 1;\n",
  );
  run([], 12, false, "lint-sentinel.ts", "src/main.ts", /evidence\/todo/);
  // Keep source membership and native contributor selection unchanged while
  // only the descriptor's declared configuration changes.
  const lintConfig = fs.readFileSync(
    path.join(root, "test/lint.config.ts"),
    "utf8",
  );
  write("test/lint.config.ts", lintConfig.replace("'error'", "'off'"));
  run([], 12);
  write("test/lint.config.ts", lintConfig);
  run([], 12, false, "lint-sentinel.ts", "src/main.ts", /evidence\/todo/);
  fs.unlinkSync(path.join(root, "test/src/lint-sentinel.ts"));
  run([], 12);
  write("test/src/model.ts", "export interface Shape { value: string }\n");
  run([], 12, false, "consumer.ts");
  write("test/src/model.ts", "export interface Shape { value: number }\n");
  run([], 12);
  write(
    "test/esm/tsconfig.json",
    JSON.stringify({
      compilerOptions: { ...common, module: "nodenext", rootDir: "." },
      include: ["*.mts", "*.d.ts"],
    }),
  );
  write(
    "test/esm/native.d.ts",
    "declare module 'node:fs' { export const readFileSync: any; } declare module 'node:url' { export const fileURLToPath: any; } declare module 'node:path' { export const dirname: any; }\n",
  );
  write("test/esm/asset.txt", "adjacent-source-asset");
  write(
    "test/esm/main.mts",
    [
      "import { readFileSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; import { dirname } from 'node:path'; declare const process: any; declare global { interface ImportMeta { url: string; main: boolean } }",
      "const result = 12, file = fileURLToPath(import.meta.url), dir = dirname(file);",
      "let stack = '';",
      "try { throw new Error('source-coordinate'); } catch (error) { stack = (error as Error).stack!; }",
      "console.log(JSON.stringify({ result, cwd:process.cwd(), file, dir, argv:process.argv[1], main:import.meta.main ?? (process.argv[1] === file), url:import.meta.url, asset:readFileSync(new URL('./asset.txt',import.meta.url),'utf8'), stack }));",
    ].join("\n"),
  );
  run([], 12, true, undefined, "esm/main.mts");
  const esmWarm = run([], 12, true, undefined, "esm/main.mts");
  run(["--no-cache"], 12, true, undefined, "esm/main.mts");
  check(() => {
    assert.ok(outcomes(esmWarm, "reused").length > 0);
    assert.equal(emitting(esmWarm).length, 0);
  });
  if (failures.length)
    throw new AggregateError(
      failures,
      "persistent runtime cache corpus failed",
    );
}
