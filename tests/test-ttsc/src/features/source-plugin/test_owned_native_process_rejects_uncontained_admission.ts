import assert from "node:assert/strict";
import type { SpawnSyncOptions } from "node:child_process";
import path from "node:path";

import { OwnedNativeProcess } from "../../../../../packages/ttsc/src/internal/OwnedNativeProcess";

/**
 * Verifies cancellation and unsupported process options refuse admission.
 *
 * 1. Refuse an already cancelled request with its original reason.
 * 2. Refuse options that cannot preserve process-tree containment.
 * 3. Leave the caller's environment authority unchanged.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual run calls reject before executable resolution for pre-abort and unsupported shell, credentials, termination signal and stdin/extra descriptor options. An intentionally absent supervisor cannot be reached in those paths.
 * @evidence contracts/testing.md#independent-expectations Original AbortSignal reason identity and literal option-refusal messages prescribe refusal independently of native execution. The caller environment record must retain its original values.
 * @evidence contracts/testing.md#distinguishing-cases Pre-abort differs from unsupported live requests; shell, uid, gid, nonforced string/numeric signals, inherited/numeric stdin and an extra descriptor each exercise a distinct refused option. Native output, cancellation after admission and descendant joining belong to the shared E2E scenario.
 * @evidence contracts/testing.md#execution-ownership One matching source unit invokes the actual owner directly with options that reject before binary resolution or child launch. No native helper, compiler, installed consumer or process protocol runs.
 */
export async function test_owned_native_process_rejects_uncontained_admission(): Promise<void> {
  const env = {
    TTSC_BINARY: path.join(import.meta.dirname, "absent-owned-native-supervisor"),
  };
  const before = { ...env };
  const controller = new AbortController();
  const reason = new Error("authored pre-admission cancellation");
  controller.abort(reason);
  await assert.rejects(
    OwnedNativeProcess.run("unreachable-command", [], { env }, controller.signal),
    (error) => error === reason,
  );
  const rows: readonly [SpawnSyncOptions, string][] = [
    [{ shell: true }, "shell, uid or gid overrides"],
    [{ uid: 0 }, "shell, uid or gid overrides"],
    [{ gid: 0 }, "shell, uid or gid overrides"],
    [{ killSignal: "SIGTERM" }, "forced process-tree termination"],
    [{ killSignal: 15 }, "forced process-tree termination"],
    [
      { stdio: "inherit" },
      "explicit input bytes and standard output descriptors",
    ],
    [
      { stdio: [0, "pipe", "pipe"] },
      "explicit input bytes and standard output descriptors",
    ],
    [
      { stdio: ["pipe", "pipe", "pipe", "pipe"] },
      "explicit input bytes and standard output descriptors",
    ],
  ];
  const failures: Error[] = [];
  for (const [options, expected] of rows) {
    try {
      await assert.rejects(
        OwnedNativeProcess.run("unreachable-command", [], { ...options, env }),
        (error: unknown) =>
          error instanceof Error && error.message.endsWith(expected),
      );
    } catch (cause) {
      failures.push(new Error(JSON.stringify(options), { cause }));
    }
  }
  assert.deepEqual(env, before);
  if (failures.length !== 0)
    throw new AggregateError(failures, "Owned native admission refusal failures");
}
