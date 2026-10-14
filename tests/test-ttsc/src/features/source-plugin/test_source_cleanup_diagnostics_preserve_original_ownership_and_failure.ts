import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { serialize } from "node:v8";

import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../../../../packages/ttsc/src/internal/SourceNativeRetirement";
import { restoreCompilerError } from "../../../../../packages/ttsc/src/internal/restoreCompilerError";
import { serializeCompilerError } from "../../../../../packages/ttsc/src/internal/serializeCompilerError";
import { decodeCapabilityCommandReply } from "../../../../../packages/ttsc/src/plugin/internal/decodeCapabilityCommandReply";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies passive cleanup diagnostics retain original ownership and failures.
 *
 * A partial cold-session report must retain the original native receipt and filesystem refusal without treating a later observation as cleanup proof.
 *
 * 1. Decode an authored native receipt and bind it to an actual admitted scope,
 *    then refuse cleanup and inspect the correlated passive observation.
 * 2. Serialize and restore that observation with a nested failure; distinguish
 *    missing-path metadata observations from the original cleanup refusal.
 * 3. Disable the observer, fail its sink and refuse reflective inspection in
 *    separate rows; require the same original errors and retained resources.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual scope admission/settlement/releaseResource, command-reply decoder and error serializer/restorer retain task/resource/boundary/receipt/guard correlation and original failure identity. Missing filesystem observations, disabled diagnostics, a throwing sink and revoked Proxy remain separate from cleanup outcomes.
 * @evidence contracts/testing.md#independent-expectations Authored task and native receipt fields define correlation; actual pre-admission guard paths and owned directory identities define resource expectations. A refused cleanup must remain the exact thrown error and the registered resource must survive, regardless of diagnostics.
 * @evidence contracts/testing.md#distinguishing-cases Joined and unknown boundary states, accepted diagnostic receipt and unavailable receipt, observed and missing paths, enabled/disabled/failed sink and failed reflection distinguish authority from evidence. Real original native receipt production and Windows handle ownership remain E2E/ETW boundaries.
 * @evidence contracts/testing.md#execution-ownership This source unit calls owning operations with authored callbacks and receipt bytes; it starts no worker, native process or installed consumer and changes no filesystem method or environment variable.
 */
export function test_source_cleanup_diagnostics_preserve_original_ownership_and_failure(): void {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-source-cleanup-observation-"));
  const missing = path.join(root, "removed-child");
  const refusal = Object.assign(new Error("authored cleanup refusal"), { code: "EPERM", syscall: "rm", path: missing });
  const observations: Readonly<Record<string, unknown>>[] = [];
  const failures: unknown[] = [];
  const receipt = Object.freeze({ helperPid: 123, targetPid: 456, version: 1, directChildJoined: true, boundaryEmpty: true, cancelled: true, status: null, signal: "SIGKILL", orphanReaping: "authored-native-owner" });
  const decoded = decodeCapabilityCommandReply(serialize({ retirement: "joined", nativeObservation: receipt }));
  const scope = SourceNativeRetirement.createScope("original-task", (observation) => observations.push(observation));
  try {
    OwnedSynchronousProcess.run({ cancel: new SharedArrayBuffer(4), failures }, () =>
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root], generation: "original-resource" });
        SourceNativeRetirement.begin("original-boundary");
        const admittedGuards = fs.readdirSync(path.join(root, ".ttsc-native-retirements")).map((entry) => path.join(root, ".ttsc-native-retirements", entry));
        SourceNativeRetirement.settle("original-boundary", "joined", undefined, decoded.nativeObservation);
        assert.throws(() => SourceNativeRetirement.releaseResource(root, () => { throw refusal; }), (error) => error === refusal);
        assert.equal(scope.resources.size, 1);
        assert.deepEqual(failures, [refusal]);
        assert.equal(observations.length, 1);
        const observed = observations[0]!;
        assert.equal(observed.taskToken, "original-task");
        assert.equal(observed.resourceRoot, root);
        const boundaries = observed.boundaries as { token: string; retirement: string; nativeObservation: unknown; admittedGuards: string[]; retainedGuards: string[] }[];
        assert.equal(boundaries[0]!.token, "original-boundary");
        assert.equal(boundaries[0]!.retirement, "joined");
        assert.deepEqual(boundaries[0]!.nativeObservation, receipt);
        assert.deepEqual(boundaries[0]!.admittedGuards, admittedGuards);
        assert.deepEqual(boundaries[0]!.retainedGuards, []);
        const filesystem = observed.filesystem as { path: string; metadata?: { dev: string; ino: string }; metadataFailure?: { code: string } }[];
        const actual = fs.lstatSync(root, { bigint: true });
        assert.deepEqual(filesystem.find((entry) => entry.path === root)!.metadata?.dev, String(actual.dev));
        assert.deepEqual(filesystem.find((entry) => entry.path === root)!.metadata?.ino, String(actual.ino));
        assert.equal(filesystem.find((entry) => entry.path === missing)!.metadataFailure?.code, "ENOENT");
        const failure = Object.assign(new AggregateError([refusal], "ownership failed"), { sourceCleanupObservations: observations });
        const restored = restoreCompilerError(serializeCompilerError(failure)) as AggregateError & { sourceCleanupObservations: unknown };
        assert.deepEqual(restored.sourceCleanupObservations, observations);
        assert.equal(restored.errors[0].code, "EPERM");
      }),
    );
    for (const observe of [undefined, () => { throw new Error("authored diagnostic sink refusal"); }]) {
      const inspected: PropertyKey[] = [];
      const original = new Proxy(refusal, { getOwnPropertyDescriptor: (target, key) => { inspected.push(key); return Reflect.getOwnPropertyDescriptor(target, key); } });
      const owner = SourceNativeRetirement.createScope("optional-sink", observe);
      SourceNativeRetirement.run(owner, () => {
        SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root] });
        SourceNativeRetirement.begin("boundary");
        SourceNativeRetirement.settle("boundary", "joined");
        assert.throws(() => SourceNativeRetirement.releaseResource(root, () => { throw original; }), (error) => error === original);
        assert.equal(owner.resources.size, 1);
        if (observe === undefined) {
          // The existing trace observer retains its five syscall fields even
          // without the new task sink. Absence of that sink adds no inspection.
          assert.deepEqual(inspected, process.env.TTSC_E2E_TRACE
            ? ["code", "errno", "syscall", "path", "dest"]
            : []);
        }
      });
    }
    const successful = SourceNativeRetirement.createScope("successful-cleanup", (observation) => observations.push(observation));
    const prior = observations.length;
    let cleaned = false;
    SourceNativeRetirement.run(successful, () => {
      SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root] });
      SourceNativeRetirement.begin("successful-boundary");
      SourceNativeRetirement.settle("successful-boundary", "not-started");
      SourceNativeRetirement.releaseResource(root, () => { cleaned = true; });
      assert.equal(cleaned, true);
      assert.equal(successful.resources.size, 0);
      assert.equal(observations.length, prior);
    });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const owner = SourceNativeRetirement.createScope("failed-reflection", (observation) => observations.push(observation));
    SourceNativeRetirement.run(owner, () => {
      SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root] });
      SourceNativeRetirement.begin("unknown-boundary");
      SourceNativeRetirement.settle("unknown-boundary", "unknown", "unproved native owner", receipt);
      assert.equal(SourceNativeRetirement.canRelease(), false, "diagnostic receipt must not grant authority");
      SourceNativeRetirement.releaseResource(root, () => { throw revoked.proxy; });
      assert.throws(() => SourceNativeRetirement.recover(owner, "unknown-boundary", "joined"), (error) => error === revoked.proxy);
      assert.equal((observations.at(-1)!.failure as { inspectionFailed: boolean }).inspectionFailed, true);
      assert.equal(owner.deferred.length, 1);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
