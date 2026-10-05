import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

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
 *
 * @evidence contracts/testing.md#behavioral-verification One ttsx run requires tools/a.ts and b.ts, must print a=3 b=3, and the real-compiler wrapper log must contain exactly one tools/tsconfig.json project build.
 * @evidence contracts/testing.md#independent-expectations Legacy method decorators receive three arguments, and the authored log filter counts actual nonterminal -p invocations of the tools config independently of runtime memo state; enabled showConfig/listFilesOnly requests are print-and-exit inspections and all their argv remain recorded.
 * @evidence contracts/testing.md#distinguishing-cases The empty files list yields no project output while two excluded roots still inherit experimentalDecorators. Windows returns before this POSIX wrapper scenario.
 * Unavailable host capabilities return false so the runner reports SKIPPED without claiming this case executed its behavioral assertions.
 *
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_builds_a_failing_project_once_for_every_file_it_owns entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary Actual root compilation, decorator execution and compiler-process invocation recording jointly expose duplicate failed-project builds; a memo unit alone cannot prove one real compiler request.
 * @evidence contracts/e2e.md#shared-execution One consumer, one tools config and two roots share one host; the wrapper delegates every call to the real compiler. The asserted nonterminal tools project emit occurs once; native option/source-list inspection calls retain separate costs, while each required root still needs its own checked emit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The log belongs to the private fixture and accumulates only this host invocation. TestProject tracks the fixture until test-process exit; wrapper/host children are synchronous. Hard termination can leave tracked temp state.
 * @evidence contracts/e2e.md#preserved-coverage Original two decorator outputs and exact one-project emit count remain; terminal native inspection calls remain in the full log and trace instead of being misclassified as duplicate emits. The early Windows return remains an explicit execution limitation.
 */
export function test_ttsx_builds_a_failing_project_once_for_every_file_it_owns():
  | void
  | false {
  if (process.platform === "win32") return false;
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
      `const { spawnSync } = require(${JSON.stringify(E2eProcessTrace.runtimePath)});`,
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
      // Native terminal inspection calls are still recorded and measured,
      // but do not attempt the failed project emit whose memo is asserted.
      const showConfig = args.lastIndexOf("--showConfig");
      const listFilesOnly = args.lastIndexOf("--listFilesOnly");
      const inspection =
        (showConfig >= 0 && args[showConfig + 1] !== "false") ||
        (listFilesOnly >= 0 && args[listFilesOnly + 1] !== "false");
      return (
        tsconfig !== undefined &&
        path.basename(tsconfig) === "tsconfig.json" &&
        path.basename(path.dirname(tsconfig)) === "tools" &&
        !inspection
      );
    });
  assert.equal(projectBuilds.length, 1, JSON.stringify(projectBuilds));
}
