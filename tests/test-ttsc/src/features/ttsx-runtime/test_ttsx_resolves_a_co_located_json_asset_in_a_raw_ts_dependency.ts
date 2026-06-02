import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a raw-`.ts` dependency that imports a co-located non-TS asset (here
 * a `./data.json`) runs under `ttsx`.
 *
 * Tsgo emits a package's `.ts` sources as `.js` into the per-package cache but
 * never copies the assets those sources import, so the emitted module's `import
 * "./data.json"` resolves beside itself in the cache, where the asset is
 * absent, and dies with `ERR_MODULE_NOT_FOUND`. The runtime hook must map such
 * an asset import back onto the dependency's source tree, where tsgo left the
 * asset, so the dependency loads it.
 *
 * 1. Install a `json-dep` whose `.ts` entry imports a sibling `data.json`.
 * 2. Run `ttsx` against an entry importing the dependency.
 * 3. Assert the dependency read the JSON asset and printed its value.
 */
export const test_ttsx_resolves_a_co_located_json_asset_in_a_raw_ts_dependency =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          resolveJsonModule: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/json-dep/package.json": JSON.stringify({
        name: "json-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      "node_modules/json-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          resolveJsonModule: true,
          outDir: "lib",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/json-dep/src/data.json": `{ "label": "from-json" }\n`,
      "node_modules/json-dep/src/index.ts":
        `import data from "./data.json" with { type: "json" };\n` +
        `export const label = (): string => (data as { label: string }).label;\n`,
      "src/main.ts": `import { label } from "json-dep";\nconsole.log(label());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "from-json");
  };
