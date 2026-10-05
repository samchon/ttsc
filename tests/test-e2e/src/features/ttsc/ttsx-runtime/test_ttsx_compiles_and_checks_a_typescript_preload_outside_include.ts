import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies ttsx compiles a TypeScript `--require` preload outside `include`
 * through its project, and stops the run when the preload has a type error.
 *
 * `ttsx` passes `-r` modules to Node's `--require` loader after the runtime
 * hooks are installed, so a `.ts` preload reaches the same lanes as a file the
 * program requires. Outside `include` it is a root no build compiled, and it is
 * checked like one (samchon/ttsc#1382). The documentation used to say that
 * `ttsx` does not compile preload files at all.
 *
 * 1. Create a project with `include: ["src"]` and a `preload.ts` beside the
 *    tsconfig that publishes a value the entry prints.
 * 2. Run the entry with `-r ./preload.ts`, then again after giving the preload a
 *    type error.
 * 3. Assert the first run prints the preloaded value, and the second fails with
 *    the preload's diagnostic before the entry runs.
 *
 * @evidence contracts/testing.md#behavioral-verification Ttsx -r ./preload.ts first prints tag=preloaded; after rewriting the excluded preload with a type error it fails with preload root/assignability diagnostics before tag= output.
 * @evidence contracts/testing.md#independent-expectations The authored preload writes the expected global tag, and string-to-number assignment independently requires rejection.
 * @evidence contracts/testing.md#distinguishing-cases Preload compilation occurs before entry execution, outside src include. The same pointer is valid then mistyped, detecting cached success or bypassed checking.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_compiles_and_checks_a_typescript_preload_outside_include entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary Node preload order, runtime hooks and native checked-root compilation must agree before the main entry runs; direct argv/planning units cannot prove suppression of its side effect.
 * @evidence contracts/e2e.md#shared-execution Two host lifetimes share one fixture and preload pointer because source validity changes. Each lifetime must install hooks before Node loads the preload; compiler preparation cannot reuse a stale typed source result.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The complete preload bytes are replaced only after the first synchronous exit. TestProject owns the fixture and runtime-owned generation state; no warm result may substitute for the negative transition.
 * @evidence contracts/e2e.md#preserved-coverage Original typed status/tag and mistyped status/root error/assignability/no-tag assertions remain. The excluded preload and failure-before-entry distinctions are retained.
 */
export function test_ttsx_compiles_and_checks_a_typescript_preload_outside_include() {
  const root = TestProject.createProject(
    FixtureFiles.read(
      "ttsc/ttsx_compiles_and_checks_a_typescript_preload_outside_include/inputs-1",
    ),
  );

  const typed = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "-r", "./preload.ts", "src/index.ts"],
    { cwd: root },
  );
  assert.equal(typed.status, 0, typed.stderr);
  assert.equal(typed.stdout.trim(), "tag=preloaded");

  TestProject.writeFiles(
    root,
    FixtureFiles.read(
      "ttsc/ttsx_compiles_and_checks_a_typescript_preload_outside_include/inputs-2",
    ),
  );
  const mistyped = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "-r", "./preload.ts", "src/index.ts"],
    { cwd: root },
  );
  assert.notEqual(mistyped.status, 0, mistyped.stdout);
  assert.match(mistyped.stderr, /root check failed for .*preload\.ts/);
  assert.match(
    mistyped.stderr,
    /Type 'string' is not assignable to type 'number'/,
  );
  assert.doesNotMatch(mistyped.stdout, /tag=/);
}
