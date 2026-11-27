import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../../internal/ttsc/internal/ttsx-decorators";

/**
 * Verifies orphan decorator lowering stays current and can run without a cache.
 *
 * The cache owns the decorated file's bytes. Inlining an imported value binds
 * that output to another file which can change without invalidating this
 * cache.
 *
 * 1. Run a decorated orphan importing a const enum through a shared cache.
 * 2. Change only the enum source, then change the package from ESM to CommonJS.
 * 3. Assert each new value is observed while the decorated file stays unchanged.
 * 4. On POSIX, load a decorated orphan with no manifest from the system temp
 *    directory and assert the decorator still runs without private cache storage.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual hosts execute an unchanged decorated orphan while imported enum values and package format mutate. Answers 1,2,3,4 with full effects detect stale imported-value inlining. A manifest-less preload must also execute a decorator when its cwd exhausts the private cache placement candidates.
 * @evidence contracts/testing.md#independent-expectations The authored enum assigns each literal answer and the authored decorators specify the exact log independently of cached JavaScript. Node's native strip cannot lower the standard decorator used in the cache-unavailable case.
 * @evidence contracts/testing.md#distinguishing-cases ESM and CommonJS each have initial/changed values, with constant decorated source. The POSIX manifest-less run has no admitted cache parent. Same-basename source selection has another orphan owner.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns four sequential launcher runs using one fixture/cache and one POSIX Node preload run without a manifest.
 * @evidence contracts/e2e.md#necessary-boundary Persistent lowering must defer imported values to next-host loading. The manifest-less Node preload must reach actual compiler lowering when its cache owner cannot provide storage. Direct compilation cannot establish either runtime behavior.
 * @evidence contracts/e2e.md#shared-execution One root, decorated source and cache serve the four launcher requests. New processes reset module state after each enum/package mutation. The direct preload reuses the prepared toolchain and exercises a separate manifest-less process.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only enum/package inputs mutate after each completed launcher request. The manifest-less run has a separate tracked source directory and synchronously completes before fixture cleanup. The launcher fixture and cache remain tracked until execution finishes.
 * @evidence contracts/e2e.md#preserved-coverage All four success/effect/answer outcomes remain. The independent preload outcome joins the collected assertions.
 */
export function test_ttsx_standard_decorators_in_orphans_do_not_cache_imported_values() {
  const failures: unknown[] = [];
  const root = TestProject.createProject({
    "package.json": '{"type":"module"}',
    "tsconfig.json": TestProject.tsconfig({
      target: "ES2022",
      module: "esnext",
      rootDir: "src",
      outDir: "dist",
    }),
    "src/main.ts":
      'const name: string = "dep"; const dep = await import(name); console.log(dep.answer); export {};',
    "node_modules/dep/src/index.ts":
      'import { Value } from "./enum";\n' +
      STANDARD_DECORATOR_SOURCE +
      "\nexport const answer = Value.Entry;",
  });
  const cacheDir = TestProject.tmpdir("ttsx-isolated-decorators-");
  for (const [type, answer] of [
    ["module", 1],
    ["module", 2],
    ["commonjs", 3],
    ["commonjs", 4],
  ] as const) {
    TestProject.writeFiles(root, {
      "node_modules/dep/package.json": JSON.stringify({
        name: "dep",
        type,
        exports: "./src/index.ts",
      }),
      "node_modules/dep/src/enum.ts": `export const enum Value { Entry = ${answer} }`,
    });
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
      cwd: root,
      env: { TTSC_CACHE_DIR: cacheDir },
    });
    try {
      assert.equal(result.status, 0, result.stderr);
    } catch (error) {
      failures.push(error);
    }
    try {
      assert.equal(
        result.stdout.trim(),
        STANDARD_DECORATOR_OUTPUT + "\n" + answer,
      );
    } catch (error) {
      failures.push(error);
    }
  }

  if (process.platform !== "win32") {
    const orphan = TestProject.tmpdir("ttsx-cacheless-orphan-");
    TestProject.writeFiles(orphan, { "entry.mts": STANDARD_DECORATOR_SOURCE });
    const preload = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "launcher",
      "internal",
      "runtimeHookPreload.js",
    );
    const result = TestProject.spawn(
      process.execPath,
      ["--require", preload, path.join(orphan, "entry.mts")],
      {
        cwd: "/tmp",
        env: {
          NODE_OPTIONS: undefined,
          TMPDIR: "/tmp",
          TTSX_RUNTIME_MANIFEST: undefined,
        },
      },
    );
    try {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT);
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length)
    throw new AggregateError(
      failures,
      "standard_decorators_in_orphans_do_not_cache_imported_values assertions failed",
    );
}
