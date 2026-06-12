import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";

/**
 * Verifies ttsx transforms runtime-generated entry-project sources shared
 * across child processes.
 *
 * A runner can generate one feature directory, spawn a child process that loads
 * it through inherited ttsx hooks, then generate another file in the same entry
 * project and spawn a second child. The generated files did not exist during
 * the entry build, but they still belong to the entry project and must use its
 * transform plugins. A stale tsconfig-wide dependency cache would miss the
 * second file and fall back to untransformed source.
 *
 * 1. Configure `@ttsc/strip` to remove `debugLog(...)` calls.
 * 2. Generate `first.ts`, load it in a child, then generate `second.ts`.
 * 3. Assert both children run and neither generated module prints its secret.
 */
export const test_ttsx_transforms_runtime_generated_entry_sources_shared_across_child_processes =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ private: true }),
      "strip.config.json": JSON.stringify({ calls: ["debugLog"] }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          esModuleInterop: true,
          plugins: [{ transform: "@ttsc/strip" }],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const __dirname: string;`,
        `declare const process: {`,
        `  execPath: string;`,
        `  stdout: { write(text: string): void };`,
        `};`,
        `declare function require(name: "node:child_process"): {`,
        `  spawnSync(`,
        `    command: string,`,
        `    args: string[],`,
        `    options: { encoding: "utf8" },`,
        `  ): { status: number | null; stdout: string; stderr: string };`,
        `};`,
        `declare function require(name: "node:fs"): {`,
        `  mkdirSync(file: string, options: { recursive: boolean }): void;`,
        `  writeFileSync(file: string, data: string): void;`,
        `};`,
        `declare function require(name: "node:path"): {`,
        `  join(...parts: string[]): string;`,
        `};`,
        ``,
        `const fs = require("node:fs");`,
        `const path = require("node:path");`,
        `const { spawnSync } = require("node:child_process");`,
        `const generated = path.join(__dirname, "generated");`,
        `fs.mkdirSync(generated, { recursive: true });`,
        ``,
        `function writeGenerated(name: string): void {`,
        `  fs.writeFileSync(`,
        `    path.join(generated, name + ".ts"),`,
        `    [`,
        `      'const debugLog = (value: string): void => console.log("SECRET:" + value);',`,
        `      'debugLog("' + name + '");',`,
        `      'export const value: string = "' + name + '";',`,
        `      "",`,
        `    ].join("\\n"),`,
        `  );`,
        `}`,
        ``,
        `function runGenerated(name: string): void {`,
        `  const result = spawnSync(`,
        `    process.execPath,`,
        `    [path.join(__dirname, "worker.ts"), "./generated/" + name],`,
        `    { encoding: "utf8" },`,
        `  );`,
        `  if (result.status !== 0) throw new Error(result.stderr);`,
        `  process.stdout.write(result.stdout);`,
        `}`,
        ``,
        `writeGenerated("first");`,
        `runGenerated("first");`,
        `writeGenerated("second");`,
        `runGenerated("second");`,
        ``,
      ].join("\n"),
      "src/worker.ts": [
        `declare const console: { log(message: string): void };`,
        `declare const process: { argv: string[] };`,
        `declare function require<T = unknown>(specifier: string): T;`,
        ``,
        `const specifier = process.argv[2];`,
        `if (specifier === undefined) throw new Error("missing specifier");`,
        `const mod = require<{ value: string }>(specifier);`,
        `console.log("worker:" + mod.value);`,
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
    assert.equal(result.stdout.trim(), "worker:first\nworker:second");
    assert.doesNotMatch(result.stdout, /SECRET/);
  };
