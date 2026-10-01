import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestUtilityPlugins } from "../../../internal/TestUtilityPlugins";

/**
 * Verifies ttsx builds a raw `.ts` dependency under its own tsconfig with the
 * transform plugin that tsconfig declares.
 *
 * A source-shipping package can need a transform to behave correctly (typia's
 * fixtures build their values with `typia.createRandom`, for example). ttsx
 * must build the dependency through its own `tsconfig.json` — plugins included
 * — not merely type-strip it. This also exercises the native-host emit path: a
 * linked transform host writes its output without printing `--listEmittedFiles`
 * lines, so the runner must treat "the directory has output" as success rather
 * than waiting for a reported file list.
 *
 * `@ttsc/strip` is configured in the dependency to drop `console.log`. The
 * dependency runs a `console.log` side effect at import time; if the transform
 * ran, that line is gone and only the entry's own output remains.
 *
 * 1. Install a `dep` whose own tsconfig declares `@ttsc/strip` and whose entry
 *    logs a secret at module scope.
 * 2. Run ttsx against an entry that imports the dependency for its value.
 * 3. Assert the secret was stripped and the dependency's value is intact.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual runtime must print only entry:dependency-value, so the imported package value survives and its secret log is removed.
 * @evidence contracts/testing.md#independent-expectations The dependency explicitly authors a secret side effect and literal value; exact combined stdout excludes executing untranslated dependency input.
 * @evidence contracts/testing.md#distinguishing-cases Owns raw-source dependency resolution under its own tsconfig and statically linked strip transform before runtime execution.
 * @evidence contracts/testing.md#execution-ownership The matching named driver export executes one actual ttsx entry and its dependency build in the shared Linux boundary population.
 * @evidence contracts/e2e.md#necessary-boundary The public runtime must discover the dependency project, assemble its strip host and execute the transformed dependency output; pure strip or cache-query units cannot prove this connection.
 * @evidence contracts/e2e.md#shared-execution Unchanged strip package source and the existing sharedPluginCache reuse the native producer; no cold-build state is observed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh entry/dependency/config/output trees isolate side effects; only unchanged strip source and production configuration identities participate in producer reuse.
 * @evidence contracts/e2e.md#preserved-coverage Original CLI success and exact stdout retain both secret-removal and dependency-value assertions.
 */
export function test_ttsx_builds_a_dependency_with_its_own_transform_plugin(): void {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          esModuleInterop: true,
        },
        include: ["src"],
      }),
      "node_modules/dep/package.json": JSON.stringify({
        name: "dep",
        version: "1.0.0",
        main: "src/index.ts",
        types: "src/index.ts",
      }),
      "node_modules/dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          rootDir: "src",
          plugins: [{ transform: "@ttsc/strip" }],
        },
        include: ["src"],
      }),
      "node_modules/dep/strip.config.json": JSON.stringify({
        calls: ["console.log"],
      }),
      "node_modules/dep/src/index.ts": [
        `console.log("dependency-secret-should-be-stripped");`,
        `export const tag: string = "dependency-value";`,
        ``,
      ].join("\n"),
      "src/main.ts": [
        `import { tag } from "dep";`,
        `console.log("entry:" + tag);`,
        ``,
      ].join("\n"),
    });
    TestUtilityPlugins.seedPackages(root, ["strip"]);

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: TestProject.sharedPluginCache(),
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "entry:dependency-value");
  }
