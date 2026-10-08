import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GoWasmLauncher } from "../../internal/GoWasmLauncher";

/**
 * Verifies the launcher passes real runtime inputs without a second Node process.
 *
 * A temporary parent can be reached through a symbolic link while cwd reports
 * its physical spelling. The live fixture resolves both paths before exit
 * cleanup removes them, so identity does not depend on the host's spelling.
 *
 * 1. Run ordinary and linked temporary parents with authored argv and excess env.
 * 2. Assert one runtime, physical temporary identity, guest root and actual cleanup.
 * 3. Preserve explicit roots and each temporary-variable fallback verbatim.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher loads a static CJS runner, which reports its PID, argv, stack option, environment and cwd. Assertions require that runtime to be the original child and check the default fixture isolation, explicit root and temporary-variable fallback cases, normal exit and output.
 * @evidence contracts/testing.md#independent-expectations Authored argument strings, exit zero, stderr text and the three permitted environment names are independent literals. The original ChildProcess PID is the OS-created authority; the runner reports its own PID independently. Live fs.realpath readings establish the same physical cwd/TMPDIR despite symbolic-link spelling, without reproducing launcher path conversion. The project root must append /project to the POSIX absolute guest temporary path.
 * @evidence contracts/testing.md#distinguishing-cases Default roots under ordinary and genuinely linked temporary parents must isolate cwd and environment and release their directories; a large unrelated variable is discarded. An explicit root preserves physically acquired cwd and exact TMPDIR spelling; empty TMPDIR falls back to TMP, then TEMP, then /tmp. Space, quote and empty arguments remain separate argv entries.
 * @evidence contracts/testing.md#execution-ownership This discoverable function unit runs the authored launcher and static fixture through Node, with no Go compile, shipped WASM, installed consumer or browser host. The helper retains the original child through exit and pipe closure; each table row keeps its own fallback input and result.
 */
export const test_go_wasm_launcher_preserves_runtime_inputs_and_normal_exit = async (): Promise<void> => {
  const args = ["probe", "0", "space argument", 'quote"argument', ""];
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-go-runner-parent-")));
  try {
    const target = path.join(parent, "temporary");
    const alias = path.join(parent, "alias");
    fs.mkdirSync(target);
    fs.symlinkSync(target, alias, process.platform === "win32" ? "junction" : "dir");
    assert.equal(fs.realpathSync(alias), target);
    assert.notEqual(alias, target);
    for (const env of [{}, { TMPDIR: alias, TMP: alias, TEMP: alias }]) {
      const ordinary = await GoWasmLauncher.run({ args, env: { ...env, TTSC_WASM_TEST_ROOT: "", UNRELATED_LARGE_INPUT: "x".repeat(16 * 1024) } });
      const reading = ordinary.reading!;
      assert.equal(reading.pid, ordinary.pid);
      assert.equal(ordinary.code, 0);
      assert.equal(ordinary.signal, null);
      assert.equal(ordinary.stderr, "authored runner stderr\n");
      assert.deepEqual(reading.argv, [ordinary.fixture, ...args]);
      assert.deepEqual(reading.execArgv, ["--stack-size=8192"]);
      assert.deepEqual(Object.keys(reading.env).sort(), ["PATH", "TMPDIR", "TTSC_WASM_TEST_ROOT"]);
      assert.notEqual(reading.cwd, ordinary.owner);
      assert.notEqual(reading.cwdRealpath, ordinary.owner);
      assert.equal(reading.tmpdirRealpath, reading.cwdRealpath);
      if (env.TMPDIR !== undefined)
        assert.equal(path.dirname(reading.cwdRealpath), target);
      assert.ok(path.posix.isAbsolute(reading.env.TMPDIR!));
      assert.equal(reading.env.TTSC_WASM_TEST_ROOT, `${reading.env.TMPDIR}/project`);
      assert.equal(fs.existsSync(reading.cwd), false);
      assert.equal(fs.existsSync(reading.cwdRealpath), false);
      assert.equal(ordinary.temporaryExistedAfterExit, false);
    }
  } finally {
    assert.equal(fs.realpathSync(path.dirname(parent)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(parent).startsWith("ttsc-go-runner-parent-"));
    fs.rmSync(parent, { recursive: true });
  }
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
