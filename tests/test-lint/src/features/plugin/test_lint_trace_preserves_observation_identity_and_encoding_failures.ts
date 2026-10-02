import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { beginLintTrace } from "../../../../../packages/lint/src/internal/lintTrace";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the private lint observer preserves caller data and call identities.
 *
 * The writer retains its first enabled root for this process. Invalid roots are
 * therefore supplied before that activation, then every enabled observation
 * uses one disposable root. The unit runner's unset marker keeps earlier
 * descriptor calls disabled; an incoming enabled runner is outside this case's
 * first-activation premise. These authored observations exercise JSONL writing,
 * without claiming a native child started or returned a product result.
 *
 * 1. Leave the marker unset or empty, then supply missing and relative roots.
 * 2. Append literal observations across two invocations in one enabled root.
 * 3. Supply unencodable data, require an integrity event, and append again.
 * 4. Disable the marker, require unchanged bytes, and restore it in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct beginLintTrace calls refuse disabled or initially invalid roots and write actual JSONL with preserved literal data, subject PID, invocation and sequence. An unencodable BigInt produces an integrity event without throwing, and a following observation is retained.
 * @evidence contracts/testing.md#independent-expectations The approved private schema v1 defines schema 1, own core fields, UTC ISO timestamps, one process nonce and distinct per-call invocation identities. Authored false, null, zero and label literals define data preservation independently of the writer, including explicit pid 0/null rather than a truthy fallback.
 * @evidence contracts/testing.md#distinguishing-cases Unset, empty, missing and relative markers contrast with one absolute directory before its first activation. Two records share an invocation while a second begin has a different invocation and the same nonce; missing pid defaults to the writer. BigInt contrasts with ordinary data, a later append proves recovery, and disabling an initialized writer leaves existing bytes unchanged.
 * @evidence contracts/testing.md#execution-ownership This discoverable source unit calls the actual private writer over one disposable filesystem root, restoring the exact marker and removing the fixture in finally. It patches no filesystem or process API, clones no writer, builds no artifact and starts no product host; native spawn outcomes remain the real boundary owner's assertions.
 */
export function test_lint_trace_preserves_observation_identity_and_encoding_failures(): void {
  const root = TestProject.tmpdir("ttsc-lint-trace-unit-");
  const previous = process.env.TTSC_E2E_TRACE;
  try {
    delete process.env.TTSC_E2E_TRACE;
    assert.equal(beginLintTrace(), undefined);
    process.env.TTSC_E2E_TRACE = "";
    assert.equal(beginLintTrace(), undefined);
    assert.deepEqual(fs.readdirSync(root), []);

    const missing = path.join(root, "missing");
    process.env.TTSC_E2E_TRACE = missing;
    assert.equal(beginLintTrace(), undefined);
    assert.equal(fs.existsSync(missing), false);
    process.env.TTSC_E2E_TRACE = ".";
    assert.equal(beginLintTrace(), undefined);
    assert.deepEqual(fs.readdirSync(root), []);

    process.env.TTSC_E2E_TRACE = root;
    const first = beginLintTrace();
    assert.notEqual(first, undefined);
    first!.record("unit-zero-pid", {
      pid: 0,
      accepted: false,
      outcome: null,
      label: "first",
    });
    first!.record("unit-null-pid", {
      pid: null,
      accepted: true,
      bytes: 0,
    });
    const second = beginLintTrace();
    assert.notEqual(second, undefined);
    second!.record("unit-next-invocation", { label: "next" });
    assert.doesNotThrow(() =>
      second!.record("unit-unencodable", { value: 1n }),
    );
    second!.record("unit-after-integrity", { accepted: true });

    const files = fs.readdirSync(root);
    assert.equal(files.length, 1);
    const filename = path.join(root, files[0]!);
    const bytes = fs.readFileSync(filename, "utf8");
    assert.equal(bytes.endsWith("\n"), true);
    const records = bytes.trimEnd().split("\n").map((line) =>
      JSON.parse(line) as TraceRecord,
    );
    assert.deepEqual(records.map(({ event }) => event), [
      "unit-zero-pid",
      "unit-null-pid",
      "unit-next-invocation",
      "trace-integrity-failure",
      "unit-after-integrity",
    ]);
    const [zero, absent, next, integrity, recovered] = records;
    assert.deepEqual(zero!.data, {
      pid: 0,
      accepted: false,
      outcome: null,
      label: "first",
    });
    assert.deepEqual(absent!.data, { pid: null, accepted: true, bytes: 0 });
    assert.deepEqual(next!.data, { label: "next" });
    assert.equal(Object.hasOwn(zero!.data, "accepted"), true);
    assert.equal(Object.hasOwn(zero!.data, "outcome"), true);
    assert.equal(Object.hasOwn(absent!.data, "pid"), true);
    assert.equal(zero!.pid, 0);
    assert.equal(absent!.pid, null);
    assert.equal(next!.pid, process.pid);
    assert.equal(zero!.invocation, absent!.invocation);
    assert.notEqual(zero!.invocation, next!.invocation);
    assert.equal(next!.invocation, integrity!.invocation);
    assert.equal(next!.invocation, recovered!.invocation);
    assert.deepEqual(records.slice(0, 3).map(({ sequence }) => sequence), [1, 2, 3]);
    assert.equal(integrity!.sequence > next!.sequence, true);
    assert.equal(recovered!.sequence > integrity!.sequence, true);
    assert.equal(integrity!.data.operation, "event-append");
    assert.equal(integrity!.data.failedEvent, "unit-unencodable");
    assert.equal(typeof integrity!.data.error, "string");
    assert.notEqual(integrity!.data.error, "");
    assert.deepEqual(recovered!.data, { accepted: true });
    assert.equal(files[0], `${process.pid}-${zero!.instance}.jsonl`);
    assert.equal(typeof zero!.instance, "string");
    assert.notEqual(zero!.instance, "");
    for (const record of records) {
      for (const field of ["schema", "event", "writerPid", "instance", "sequence", "at", "invocation", "pid", "data"]) {
        assert.equal(Object.hasOwn(record, field), true, field);
      }
      assert.equal(record.schema, 1);
      assert.equal(record.writerPid, process.pid);
      assert.equal(record.instance, zero!.instance);
      assert.match(record.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }

    process.env.TTSC_E2E_TRACE = "";
    assert.equal(beginLintTrace(), undefined);
    assert.equal(fs.readFileSync(filename, "utf8"), bytes);
    assert.deepEqual(fs.readdirSync(root), files);
  } finally {
    if (previous === undefined) delete process.env.TTSC_E2E_TRACE;
    else process.env.TTSC_E2E_TRACE = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

interface TraceRecord {
  schema: number;
  event: string;
  writerPid: number;
  instance: string;
  sequence: number;
  at: string;
  invocation: string;
  pid: number | null;
  data: Record<string, unknown>;
}
