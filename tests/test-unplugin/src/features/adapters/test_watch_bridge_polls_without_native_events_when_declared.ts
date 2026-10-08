import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/src/core/bridge/openHostWatchBridge";
import { projectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/projectRecordFile";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";
import { captureWatchInputBaseline } from "../../../../../packages/unplugin/src/core/transform/watch/captureWatchInputBaseline";
import type { TtscWatchInput } from "../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInput";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies declared build-host polling observes helper changes without events.
 *
 * The observer seam deliberately remains silent; it is not a failed native
 * backend. Explicit ticks exercise owned observation and actual record writes.
 *
 * 1. Poll unchanged bytes, then changed bytes, and distinguish their record signals.
 * 2. Register a failed delivery after removal and observe repaired bytes through polling.
 * 3. Replace a native session before its handle retires; reject old callbacks and poll the replacement.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual openHostWatchBridge registration, bounded poll checks, failure retention, record movement and close operate on authored helper files. Native callbacks work while active; callbacks from a closed bridge cannot signal after a polling replacement registers, even while native retirement is withheld.
 * @evidence contracts/testing.md#independent-expectations Authored initial/changed/repaired bytes prescribe unchanged versus moved record signals. Captured graph evidence supplies input setup, not expected verdicts; acquisition/closure counters observe handles returned by the owned seam.
 * @evidence contracts/testing.md#distinguishing-cases Same-byte content, changed content, missing helper with failed empty registration, repaired helper, late tick after close, working native callbacks and immediate native-to-polling restart before retirement distinguish observation, recovery and release. A second replacement publication after old retirement proves late cleanup did not erase its registration.
 * @evidence contracts/testing.md#execution-ownership One temporary project and record serve three bridges. Injected watch/poll handles run no native child or bundler; one native handle withholds physical retirement until the replacement has published through its own tick. Actual filesystem evidence and record operations execute; all bridges close and deferred retirement completes in finally.
 */
export async function test_watch_bridge_polls_without_native_events_when_declared(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-build-watch-polling-");
  const helper = path.join(root, "helper.ts");
  const tsconfig = path.join(root, "tsconfig.json");
  fs.writeFileSync(helper, "initial\n");
  fs.writeFileSync(tsconfig, "{}");
  const record = projectRecordFile(path.join(root, ".ttsc"), tsconfig);
  writeProjectRecordFile(record, {
    inputs: {}, membership: null, root, signal: 0, tsconfig,
  });
  const current = (): TtscWatchInput[] => {
    const baseline = captureWatchInputBaseline(helper);
    assert.ok(baseline);
    return [{
      file: helper,
      evidence: {
        identity: baseline.identity,
        missing: !baseline.fileExists,
        state: { codec: "graph", hash: baseline.graphHash, realpath: baseline.realpath.ok ? baseline.realpath.path : null },
      },
    }];
  };
  const signal = () => readProjectRecordFile(record)?.signal;
  let tick: (() => void) | undefined;
  let emit: ((event: string, file: string | null) => void) | undefined;
  let nativeOpens = 0;
  let nativeCloses = 0;
  let retireNative: (() => void) | undefined;
  let pollOpens = 0;
  let pollCloses = 0;
  const operations = {
    caseSensitive: () => true,
    watch: (_root: string, listener: (event: string, file: string | null) => void) => {
      nativeOpens++;
      emit = listener;
      return { close: () => { retireNative = () => { nativeCloses++; retireNative = undefined; }; } };
    },
    poll: (listener: () => void) => {
      pollOpens++;
      tick = listener;
      return { close: () => { pollCloses++; } };
    },
  };
  const bridge = openHostWatchBridge(root, operations, true);
  try {
    bridge.register(record, current(), false, bridge.begin());
    bridge.compiled(() => true);
    assert.equal(nativeOpens, 0);
    assert.equal(pollOpens, 1);
    assert.ok(tick);
    fs.writeFileSync(helper, "initial\n");
    tick();
    assert.equal(signal(), 0);
    fs.writeFileSync(helper, "changed\n");
    tick();
    assert.equal(signal(), 1);
    bridge.register(record, current(), false, bridge.begin());
    fs.unlinkSync(helper);
    bridge.register(record, [], true, bridge.begin());
    assert.ok(tick);
    tick();
    fs.writeFileSync(helper, "repaired\n");
    tick();
    assert.ok((signal() ?? 0) > 1, "repair remains observed after failed delivery");
  } finally {
    await bridge.close();
  }
  const settled = signal();
  tick?.();
  assert.equal(signal(), settled, "closed polling cannot move a record");
  assert.equal(pollCloses, pollOpens);
  const native = openHostWatchBridge(root, operations, false);
  try {
    native.register(record, current(), false, native.begin());
    assert.equal(nativeOpens, 1);
    assert.ok(emit);
    fs.writeFileSync(helper, "native changed\n");
    emit("change", helper);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    assert.ok((signal() ?? 0) > (settled ?? 0));
    const staleCallback = emit;
    const closing = native.close();
    const replacement = openHostWatchBridge(root, operations, true);
    try {
      replacement.register(record, current(), false, replacement.begin());
      assert.equal(nativeCloses, 0, "prior native retirement is still pending");
      const before = signal();
      fs.writeFileSync(helper, "replacement changed\n");
      staleCallback("change", helper);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      assert.equal(signal(), before, "the closed observer cannot publish into its replacement");
      assert.ok(tick);
      tick();
      assert.ok((signal() ?? 0) > (before ?? 0), "the replacement publishes through its own poll");
      const published = signal();
      staleCallback("change", helper);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      assert.equal(signal(), published, "late native callbacks cannot duplicate publication");
      retireNative?.();
      await closing;
      assert.equal(nativeCloses, 1, "the original native handle eventually retires");
      replacement.register(record, current(), false, replacement.begin());
      fs.writeFileSync(helper, "after original retirement\n");
      tick();
      assert.ok((signal() ?? 0) > (published ?? 0), "old retirement leaves the replacement usable");
    } finally {
      await replacement.close();
      retireNative?.();
      await closing;
    }
  } finally {
    await native.close();
    if (nativeCloses === 0) retireNative?.();
  }
  assert.equal(nativeCloses, nativeOpens);
  assert.equal(pollCloses, pollOpens);
}
