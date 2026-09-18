import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx attempts a project build that produces nothing once per
 * process, however many files of that project the program reaches.
 *
 * A file outside every checked build is first looked for in its owning
 * project's build, and when that build produces nothing it is compiled as a
 * root of its own. A config that lists no files never produces anything, so
 * without a memo of the failure every file it owns runs the whole project build
 * again before its own root build: one wasted compiler run per file. A wrapper
 * around the real compiler logs each invocation, which is the only place the
 * repeated build is visible. The wrapper is a script, which Windows cannot run
 * as the compiler binary, so the case runs on POSIX.
 *
 * 1. Create `tools/tsconfig.json` with `files: []` and `experimentalDecorators`,
 *    and two files beside it that record a method decorator's argument count.
 * 2. Run an entry that requires both through a logging compiler wrapper.
 * 3. Assert both files got the project's options and the project was built once.
 */
export const test_ttsx_builds_a_failing_project_once_for_every_file_it_owns =
  () => {
    if (process.platform === "win32") return;
    const probe = (name: string): string =>
      [
        `let observed: number = 0;`,
        `function probe(...args: any[]): void {`,
        `  observed = args.length;`,
        `}`,
        `class Box {`,
        `  @probe`,
        `  method(): void {}`,
        `}`,
        `new Box();`,
        `export const ${name}: number = observed;`,
        ``,
      ].join("\n");
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "consumer", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const require: (path: string) => Record<string, number>;`,
        `const { a } = require("../tools/a.ts");`,
        `const { b } = require("../tools/b.ts");`,
        `console.log("a=" + a + " b=" + b);`,
        `export {};`,
        ``,
      ].join("\n"),
      "tools/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          experimentalDecorators: true,
          types: [],
        },
        files: [],
      }),
      "tools/a.ts": probe("a"),
      "tools/b.ts": probe("b"),
    });
    const log = path.join(root, "compiler.jsonl");
    const wrapper = path.join(root, "compiler-wrapper");
    fs.writeFileSync(
      wrapper,
      [
        `#!${process.execPath}`,
        `const fs = require("node:fs");`,
        `const { spawnSync } = require("node:child_process");`,
        `const args = process.argv.slice(2);`,
        `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + "\\n");`,
        `const result = spawnSync(${JSON.stringify(TestProject.TSGO_BINARY)}, args, { stdio: "inherit" });`,
        `process.exit(result.status ?? 1);`,
        ``,
      ].join("\n"),
      { encoding: "utf8", mode: 0o755 },
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root, env: { TTSC_TSGO_BINARY: wrapper } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "a=3 b=3");
    const projectBuilds = fs
      .readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as string[])
      .filter((args) => {
        const tsconfig = args[args.indexOf("-p") + 1];
        return (
          tsconfig !== undefined &&
          path.basename(tsconfig) === "tsconfig.json" &&
          path.basename(path.dirname(tsconfig)) === "tools"
        );
      });
    assert.equal(projectBuilds.length, 1, JSON.stringify(projectBuilds));
  };
