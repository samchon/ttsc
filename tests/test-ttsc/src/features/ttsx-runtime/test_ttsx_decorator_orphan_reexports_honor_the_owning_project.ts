import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorated orphan barrels respect re-exported sources' project emit.
 *
 * Export discovery reaches both isolated and project-owned sources. Applying
 * orphan options to an owned source can invent a const-enum export its compiler
 * erased, or miss a value the project preserved.
 *
 * 1. Re-export a project-owned const enum from a decorated CommonJS orphan.
 * 2. Run with preserveConstEnums disabled and enabled through cold/warm caches.
 * 3. Assert names match real values and name discovery executes no source effects.
 */
export const test_ttsx_decorator_orphan_reexports_honor_the_owning_project =
  () => {
    // Node 22's ESM-to-CJS bridge cannot require a hook-loaded ESM dependency.
    // CI uses Node 24; CommonJS-owned sources remain covered on the runtime floor.
    const modules =
      Number(process.versions.node.split(".")[0]) >= 24
        ? ["commonjs", "esnext"]
        : ["commonjs"];
    for (const module of modules) {
      for (const preserve of [false, true]) {
        const root = TestProject.createProject({
          "package.json": '{"type":"module"}',
          "tsconfig.json": TestProject.tsconfig({
            target: "ES2022",
            module: "esnext",
            rootDir: "src",
            outDir: "dist",
          }),
          "src/main.ts":
            'const name: string = "dep"; const dep = await import(name); console.log(Object.hasOwn(dep, "Value"), Object.hasOwn(dep.default, "Value"), dep.Value?.Entry ?? "missing", dep.actual); export {};',
          "node_modules/dep/package.json":
            '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
          "node_modules/dep/index.ts":
            STANDARD_DECORATOR_SOURCE + '\nexport * from "./values/entry";',
          "node_modules/dep/values/package.json": JSON.stringify({
            type: module === "esnext" ? "module" : "commonjs",
          }),
          "node_modules/dep/values/tsconfig.json": TestProject.tsconfig(
            {
              target: "ES2022",
              module,
              rootDir: ".",
              outDir: "lib",
              preserveConstEnums: preserve,
            },
            { include: ["entry.ts"] },
          ),
          "node_modules/dep/values/entry.ts":
            'console.log("values-loaded"); export const enum Value { Entry = 42 } export const actual = 17;',
        });
        const cacheDir = TestProject.tmpdir("ttsx-owned-reexport-");
        for (let i = 0; i < 2; i++) {
          const result = TestProject.spawn(
            TestProject.TTSX_BIN,
            ["src/main.ts"],
            { cwd: root, env: { TTSC_CACHE_DIR: cacheDir } },
          );
          assert.equal(result.status, 0, result.stderr);
          const lines = result.stdout.trim().split(/\r?\n/);
          assert.ok(result.stdout.includes(STANDARD_DECORATOR_OUTPUT));
          assert.equal(
            lines.filter((line) => line === "values-loaded").length,
            1,
          );
          assert.equal(
            lines.at(-1),
            `${preserve} ${preserve} ${preserve ? 42 : "missing"} 17`,
          );
        }
      }
    }
  };
