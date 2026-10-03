import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx compiles and type-checks a TypeScript file the running program
 * writes and then requires.
 *
 * A generated file cannot be in any build that ran before the program started,
 * which puts it in the same state as a file outside `include`: no checked
 * program covered it. It must still run from its own code, compiled through its
 * owning project, and a type error in it must stop the run the same way. Before
 * samchon/ttsc#1382 a generated `index.ts` could run as any emitted `index.js`
 * that happened to share its name.
 *
 * 1. Create a project whose entry writes `generated/value.ts` from an environment
 *    variable and then requires it.
 * 2. Run it with a well-typed source, then with a mistyped one.
 * 3. Assert the first run prints the generated value, and the second fails with
 *    the generated file's diagnostic before printing anything from it.
 * @evidence contracts/testing.md#behavioral-verification Ttsx runs a generator twice: well-typed generated/value.ts prints value=generated, whereas a string assigned to number fails with that root diagnostic before any value= output.
 * @evidence contracts/testing.md#independent-expectations The literal generated export and TypeScript assignability determine opposite results independently of runtime cache ownership.
 * @evidence contracts/testing.md#distinguishing-cases The file is created only after the root program starts and is outside src include. Typed and mistyped versions differ while the launcher/project remain the same.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_checks_a_typescript_file_the_program_generates_before_running_it entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary Actual program writes, runtime require, native type-check and execution gate must connect for newly generated source. A direct membership/cache unit cannot prove that mistyped generated code is prevented from running.
 * @evidence contracts/e2e.md#shared-execution Two host lifetimes share one fixture because the generated source changes between runs. The entry is prepared in each run, and the newly generated root is separately compiled on demand; no package install is repeated.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each run overwrites the complete generated source from its child environment. Sequential synchronous exits prevent previous live hosts from owning the next version; TestProject releases the tracked fixture.
 * @evidence contracts/e2e.md#preserved-coverage All original typed status/value and mistyped status/root-message/assignability/no-output assertions remain. No generated-source distinction is collapsed into a warm success.
 */
export function test_ttsx_checks_a_typescript_file_the_program_generates_before_running_it() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_checks_a_typescript_file_the_program_generates_before_running_it/inputs-1"));

    const typed = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          GENERATED_SOURCE: `export const value: string = "generated";\n`,
        },
      },
    );
    assert.equal(typed.status, 0, typed.stderr);
    assert.equal(typed.stdout.trim(), "value=generated");

    const mistyped = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          GENERATED_SOURCE: `export const value: number = "mistyped";\n`,
        },
      },
    );
    assert.notEqual(mistyped.status, 0, mistyped.stdout);
    assert.match(mistyped.stderr, /root check failed for .*value\.ts/);
    assert.match(
      mistyped.stderr,
      /Type 'string' is not assignable to type 'number'/,
    );
    assert.doesNotMatch(mistyped.stdout, /value=/);
  }
