import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx runs the entry as Node's own main module, with the process
 * semantics `node <entry>` gives it.
 *
 * Pins samchon/ttsc#1402. ttsx used to start a bootstrap as the main module and
 * load the entry from it, so in the entry `require.main === module` was false,
 * `import.meta.main` was false, an error thrown while the entry evaluated was
 * caught by the bootstrap before `process.on("uncaughtException")` could see
 * it, and a `main()` guarded by `require.main === module` silently never ran.
 * The entry is now what Node runs.
 *
 * 1. Create a CommonJS entry, an ES module entry that imports a helper, an entry
 *    that handles its own uncaught error, and entries that exit with a code,
 *    throw, or reject a top-level await.
 * 2. Run each through ttsx.
 * 3. Assert the main-module answers, `process.argv[1]`, the handled error, and the
 *    exit codes match what `node` gives.
 *
 * @evidence contracts/testing.md#behavioral-verification Six actual NativeNode entry lifetimes verify CJS main and physical argv1, ESM entry/helper main identity, handled uncaught exception, explicit exit 7, unhandled throw and top-level rejection.
 * @evidence contracts/testing.md#independent-expectations Physical realpath identity and literal statuses/output are independent Node contracts; import.meta.main capability is probed on the native test host, never inferred from product-returned fields.
 * @evidence contracts/testing.md#distinguishing-cases Normal CJS and ESM entries are paired with handled, thrown, rejected and explicit-exit paths; helper main false distinguishes the entry from an imported module.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary Six actual NativeNode entry lifetimes verify CJS main and physical argv1, ESM entry/helper main identity, handled uncaught exception, explicit exit 7, unhandled throw and top-level rejection. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One immutable compiler workspace contains all six entries. Six host lifetimes are required because fatal errors and process.exit end a host; equivalent per-entry compiler preparation has not yet been reduced further.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each synchronous spawn owns a separate process so exception listeners and exit behavior cannot contaminate another case; the same immutable source graph is reused and no cold-cache claim is made.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export function test_ttsx_runs_the_entry_as_the_main_module() {
  const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_runs_the_entry_as_the_main_module/inputs-1"));
  const run = (entry: string) =>
    TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, entry], {
      cwd: root,
    });

  const failures: unknown[] = [];
  try {
    const cjs = run("src/cjs.ts");
    assert.equal(cjs.status, 0, cjs.stderr);
    const reported = JSON.parse(cjs.stdout.trim()) as {
      main: boolean;
      argv1: string;
    };
    assert.equal(reported.main, true);
    assert.equal(
      fs.realpathSync.native(reported.argv1),
      fs.realpathSync.native(path.join(root, "src", "cjs.ts")),
    );
  } catch (error) {
    failures.push(error);
  }
  try {
    const esm = run("src/esm.mts");
    assert.equal(esm.status, 0, esm.stderr);
    const meta = JSON.parse(esm.stdout.trim()) as {
      main?: unknown;
      helperMain?: unknown;
    };
    // Native host capability is independent of the product-returned fields;
    // a supported API silently dropped by the runtime must fail this assertion.
    if ("main" in import.meta) {
      assert.equal(meta.main, true);
      assert.equal(meta.helperMain, false);
    } else {
      assert.equal(meta.main, undefined);
      assert.equal(meta.helperMain, undefined);
    }
  } catch (error) {
    failures.push(error);
  }
  try {
    const handled = run("src/handled.ts");
    assert.equal(handled.status, 0, handled.stderr);
    assert.deepEqual(handled.stdout.trim().split(/\r?\n/), [
      "handled: boom",
      "still alive",
    ]);
  } catch (error) {
    failures.push(error);
  }
  try {
    assert.equal(run("src/exit.ts").status, 7);
  } catch (error) {
    failures.push(error);
  }
  try {
    const thrown = run("src/throws.ts");
    assert.equal(thrown.status, 1, thrown.stdout);
    assert.match(thrown.stderr, /unhandled/);
  } catch (error) {
    failures.push(error);
  }
  try {
    const rejected = run("src/rejects.mts");
    assert.equal(rejected.status, 1, rejected.stdout);
    assert.match(rejected.stderr, /rejected/);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length)
    throw new AggregateError(failures, "native main-module entry failures");

}
