import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GoWasmLauncher } from "../../internal/GoWasmLauncher";

/**
 * Verify the launcher passes real runtime inputs without a second Node process.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher loads a static CJS runner, which reports its PID, argv, stack option, environment and cwd. Assertions require that runtime to be the original child and check the default fixture isolation, explicit root and temporary-variable fallback cases, normal exit and output.
 * @evidence contracts/testing.md#independent-expectations Authored argument strings, exit zero, stderr text and the three permitted environment names are independent literals. The original ChildProcess PID is the OS-created authority; the runner reports its own PID independently. Native path operations derive the Windows guest spelling from the observed temporary drive, without calling launcher helpers.
 * @evidence contracts/testing.md#distinguishing-cases The default root with a large unrelated variable must isolate cwd and environment and release its directory. An explicit root preserves cwd and TMPDIR; empty TMPDIR falls back to TMP, then TEMP, then /tmp. Space, quote and empty arguments remain separate argv entries.
 * @evidence contracts/testing.md#execution-ownership This discoverable function unit runs the authored launcher and static fixture through Node, with no Go compile, shipped WASM, installed consumer or browser host. The helper retains the original child through exit and pipe closure; each table row keeps its own fallback input and result.
 */
export const test_go_wasm_launcher_preserves_runtime_inputs_and_normal_exit = async (): Promise<void> => {
  const args = ["probe", "0", "space argument", 'quote"argument', ""];
  const ordinary = await GoWasmLauncher.run({ args, env: { TTSC_WASM_TEST_ROOT: "", UNRELATED_LARGE_INPUT: "x".repeat(16 * 1024) } });
  const reading = ordinary.reading!;
  assert.equal(reading.pid, ordinary.pid);
  assert.equal(ordinary.code, 0);
  assert.equal(ordinary.signal, null);
  assert.equal(ordinary.stderr, "authored runner stderr\n");
  assert.deepEqual(reading.argv, [ordinary.fixture, ...args]);
  assert.deepEqual(reading.execArgv, ["--stack-size=8192"]);
  assert.deepEqual(Object.keys(reading.env).sort(), ["PATH", "TMPDIR", "TTSC_WASM_TEST_ROOT"]);
  assert.notEqual(reading.cwd, ordinary.owner);
  const guest = process.platform === "win32"
    ? `/${path.relative(path.parse(reading.cwd).root, reading.cwd).replaceAll("\\", "/")}`
    : reading.cwd;
  assert.equal(reading.env.TMPDIR, guest);
  assert.equal(reading.env.TTSC_WASM_TEST_ROOT, `${guest}/project`);
  assert.equal(fs.existsSync(reading.cwd), false);
  assert.equal(ordinary.temporaryExistedAfterExit, false);
  for (const input of [
    { TMPDIR: "explicit-tmpdir", TMP: "second", TEMP: "third", expected: "explicit-tmpdir" },
    { TMPDIR: "", TMP: "second", TEMP: "third", expected: "second" },
    { TMPDIR: "", TMP: "", TEMP: "third", expected: "third" },
    { TMPDIR: "", TMP: "", TEMP: "", expected: "/tmp" },
  ]) {
    const { expected, ...env } = input;
    const configured = await GoWasmLauncher.run({ env: { ...env, TTSC_WASM_TEST_ROOT: "/explicit-project" } });
    assert.equal(configured.code, 0, expected);
    assert.equal(configured.reading?.pid, configured.pid, expected);
    assert.equal(configured.reading?.cwd, configured.owner, expected);
    assert.equal(configured.reading?.env.TMPDIR, expected);
    assert.equal(configured.reading?.env.TTSC_WASM_TEST_ROOT, "/explicit-project");
  }
};
