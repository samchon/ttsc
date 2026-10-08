import assert from "node:assert/strict";

import { GoWasmLauncher } from "../../internal/GoWasmLauncher";

/**
 * Verify runner failures and cancellation end the actual owned runtime.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher preserves an authored exit 27 and runner stderr, reports a throwing or missing CJS runner as a nonzero failure, and receives SIGTERM through the original ChildProcess after the idle runner reports readiness. The runtime PID must equal that original child, whose exit and pipe closure are joined.
 * @evidence contracts/testing.md#independent-expectations The fixture authors exit 27 and the thrown message; a nonexistent runner cannot load successfully. Original ChildProcess identity and SIGTERM define cancellation independently of launcher internals. The expected same runtime PID distinguishes an intermediate waiting Node even where Windows also retires its children.
 * @evidence contracts/testing.md#distinguishing-cases Nonzero voluntary exit, a runner exception, a missing entry and cancellation of a ready live runtime cover distinct completion paths. Normal inputs, isolation and success belong to the sibling launcher test. A file gate lets a nested-runner regression finish without using a PID lookup for cleanup.
 * @evidence contracts/testing.md#execution-ownership This discoverable function unit exercises only the authored Node launcher and static CJS fixture. It builds no Go or WASM artifact and installs no consumer. Cancellation uses the original ChildProcess object and the helper waits for exit and complete output closure before releasing known owned fixture inputs.
 */
export const test_go_wasm_launcher_preserves_failure_and_signal_ownership = async (): Promise<void> => {
  const failed = await GoWasmLauncher.run({ args: ["probe", "27"] });
  assert.equal(failed.reading?.pid, failed.pid);
  assert.equal(failed.code, 27);
  assert.equal(failed.signal, null);
  assert.equal(failed.stderr, "authored runner stderr\n");
  const thrown = await GoWasmLauncher.run({ args: ["throw"] });
  assert.notEqual(thrown.code, 0);
  assert.match(thrown.stderr, /authored runner failure/);
  const missing = await GoWasmLauncher.run({ missingRunner: true });
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /MODULE_NOT_FOUND/);
  const cancelled = await GoWasmLauncher.run({ cancel: true });
  assert.equal(cancelled.reading?.pid, cancelled.pid);
  assert.equal(cancelled.killAccepted, true);
  assert.equal(cancelled.code, null);
  assert.equal(cancelled.signal, "SIGTERM");
};
