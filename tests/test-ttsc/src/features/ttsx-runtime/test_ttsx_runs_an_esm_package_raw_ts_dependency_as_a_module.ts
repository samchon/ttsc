import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx loads a raw `.ts` dependency from an ESM package as a module.
 *
 * A dependency that ships ESM source declares `type: "module"`; ttsx classifies
 * each served file by that package `type` (and file extension), the same way
 * Node and tsgo do — never by sniffing the source text. So an `export` in a
 * `type: "module"` package loads as an ES module without any syntax heuristic.
 *
 * 1. Install a published `pub-dep` with `type: "module"` whose `.ts` source uses
 *    ESM `export`.
 * 2. Run ttsx against an entry that imports a named export from it.
 * 3. Assert the named export resolved and executed.
 */
export const test_ttsx_runs_an_esm_package_raw_ts_dependency_as_a_module =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/pub-dep/package.json": JSON.stringify({
        name: "pub-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./index.ts" },
      }),
      "node_modules/pub-dep/index.ts": `export const detect = (): string => "loaded-as-module";\n`,
      "src/main.ts": `import { detect } from "pub-dep";\nconsole.log(detect());\n`,
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "loaded-as-module");
  };
