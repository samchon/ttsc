import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/src/core/bridge/openHostWatchBridge";
import { projectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/projectRecordFile";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * A new delivery can answer a changed condition while a large wave yields.
 * The old registration's delayed report must not resurrect its owed signal.
 *
 * @evidence contracts/testing.md#behavioral-verification The real bridge observes deleted files through its actual observer and writes actual records. A current replacement during the first yield must leave its record unowed and unmoved after the wave finishes; unchanged and stale-registration controls must still be signalled.
 * @evidence contracts/testing.md#independent-expectations Literal file-existence predicates describe the disk before and after deletion. A changed final padding condition establishes wave completion independently of its internal quota; record signal zero and owed false express a delivery that already answered the change.
 * @evidence contracts/testing.md#distinguishing-cases Current post-event evidence contrasts with no replacement and stale evidence under the old token. All three use the same large native wave and complete before aggregate failure reporting, so dropping every delayed report cannot pass.
 * @evidence contracts/testing.md#execution-ownership This source unit invokes the real bridge and observer with supported quiet watch/poll capabilities over temporary files and records. It launches no native host or producer; finally closes each bridge and clears its timers.
 */
export async function test_watch_bridge_drops_a_wave_report_answered_during_a_yield(): Promise<void> {
  const failures: unknown[] = [];
  for (const mode of ["answered", "unanswered", "stale"] as const) {
    const root = TestProject.createProject({ "first.ts": "first", "last.ts": "last" });
    const first = path.join(root, "first.ts");
    const last = path.join(root, "last.ts");
    const record = projectRecordFile(path.join(root, ".ttsc"), path.join(root, "tsconfig.json"));
    const padding = projectRecordFile(path.join(root, ".ttsc"), path.join(root, "padding.json"));
    for (const file of [record, padding])
      writeProjectRecordFile(file, { inputs: {}, membership: null, root, signal: 0, tsconfig: first });
    const input = (file: string, exists: boolean) => ({
      file,
      evidence: {
        identity: file,
        missing: !exists,
        state: { codec: "predicates" as const, observation: { fileExists: exists } },
      },
    });
    let emit!: (event: string, file: string | null) => void;
    const bridge = openHostWatchBridge(root, {
      caseSensitive: () => true,
      poll: () => ({ close: () => undefined }),
      watch: (_root, listener) => { emit = listener; return { close: () => undefined }; },
    });
    try {
      const old = bridge.begin();
      bridge.register(record, [input(first, true)], false, old);
      bridge.register(padding, [
        ...Array.from({ length: 200 }, (_, i) => input(path.join(root, `absent-${i}.ts`), false)),
        input(last, true),
      ], false, old);
      fs.unlinkSync(first);
      fs.unlinkSync(last);
      emit("change", path.join(root, "ALIAS~1.TS"));
      await new Promise<void>((resolve) => setTimeout(() => {
        if (mode === "answered") bridge.register(record, [input(first, false)], false, bridge.begin());
        if (mode === "stale") bridge.register(record, [input(first, true)], false, old);
        resolve();
      }, 0));
      const end = performance.now() + 3_000;
      while (!bridge.owes(padding) && performance.now() < end)
        await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(bridge.owes(padding), true, "the final changed condition completed the wave");
      assert.equal(bridge.owes(record), mode !== "answered", mode);
      if (mode === "answered")
        assert.equal(readProjectRecordFile(record)?.signal, 0, "a completed delivery cannot acquire an old signal");
    } catch (error) {
      failures.push(new Error(mode, { cause: error }));
    } finally {
      await bridge.close();
    }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "yielded bridge acknowledgments");
}
