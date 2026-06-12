import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";

/**
 * Verifies ttsx extends a dependency build cache when a source file appears
 * after that dependency was already built once in the same run.
 *
 * Runtime-generated test corpora can create one batch of sources, execute it,
 * then create another batch under the same tsconfig. The first import builds
 * the dependency cache; the second import must not treat that tsconfig-level
 * cache marker as enough unless the requested source has emitted JavaScript.
 *
 * `@ttsc/strip` is configured in the dependency. If the later generated source
 * falls through to the raw single-file fallback instead of a source-aware
 * dependency shard build, its `console.log` side effect leaks into stdout.
 */
export const test_ttsx_extends_dependency_cache_for_runtime_generated_sources =
  () => {
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
      "node_modules/dep/src/index.ts": `export const ready = true;\n`,
      "src/main.ts": [
        `declare const __dirname: string;`,
        `declare function require<T = unknown>(name: string): T;`,
        `const fs = require<{`,
        `  mkdirSync(p: string, o: { recursive: boolean }): void;`,
        `  writeFileSync(p: string, data: string): void;`,
        `}>("node:fs");`,
        `const path = require<{ join(...parts: string[]): string }>(`,
        `  "node:path",`,
        `);`,
        ``,
        `const generated = path.join(`,
        `  __dirname,`,
        `  "..",`,
        `  "node_modules",`,
        `  "dep",`,
        `  "src",`,
        `  "generated",`,
        `);`,
        `fs.mkdirSync(generated, { recursive: true });`,
        `const writeSource = (name: string, value: string): void =>`,
        `  fs.writeFileSync(`,
        `    path.join(generated, name + ".ts"),`,
        `    [`,
        `      "console.log(\\"SECRET-" + value + "\\");",`,
        `      "export const value: string = \\"" + value + "\\";",`,
        `      "",`,
        `    ].join("\\n"),`,
        `  );`,
        ``,
        `writeSource("first", "first");`,
        `const first = require<{ value: string }>(`,
        `  path.join(generated, "first.ts"),`,
        `);`,
        `writeSource("second", "second");`,
        `const second = require<{ value: string }>(`,
        `  path.join(generated, "second.ts"),`,
        `);`,
        `console.log("VALUES:" + first.value + ":" + second.value);`,
        ``,
      ].join("\n"),
    });
    TestUtilityPlugins.seedPackages(root, ["strip"]);

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root, env: { PATH: TestUtilityPlugins.goPath() } },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "VALUES:first:second");
    assert.equal(result.stdout.includes("SECRET-"), false);
  };
