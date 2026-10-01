import assert from "node:assert/strict";

import { bufferResidentCheckEntryRequests } from "../../../../../packages/ttsc/src/compiler/internal/build/bufferResidentCheckEntryRequests";
import { planResidentCheckEntries } from "../../../../../packages/ttsc/src/compiler/internal/build/planResidentCheckEntries";
import { takeResidentCheckEntryRequest } from "../../../../../packages/ttsc/src/compiler/internal/build/takeResidentCheckEntryRequest";

/**
 * Verifies duplicate resident check entries share a process, not pending state.
 *
 * A resident process is keyed by binary, plugin name, and native arguments. The
 * same configured entry may therefore execute twice through one process, while
 * each entry still needs its own complete filesystem-change stream.
 *
 * 1. Plan two identical synthetic check entries and require one shared key.
 * 2. Buffer one cycle and consume only the first entry (as if it failed before
 *    the second entry ran).
 * 3. Buffer the next cycle and require the deferred entry to retain both
 *    transitions while the first entry receives only the new transition.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls planResidentCheckEntries, bufferResidentCheckEntryRequests and takeResidentCheckEntryRequest to preserve separate entry positions and change delivery despite equal process keys.
 * @evidence contracts/testing.md#independent-expectations Literal initial/next path lists establish exactly what each independently indexed entry receives. Duplicate-path union, sticky invalidation and compiler-argument key differences follow the delivery/process-identity contract rather than mirroring key construction.
 * @evidence contracts/testing.md#distinguishing-cases Two identical entries share a key but retain independent pending deltas when the first consumes early. Later cycles accumulate only for the deferred entry, consumption releases both slots, missing consumption rejects, duplicate changes deduplicate, and false cannot clear prior invalidation.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/watch; it uses a synthetic plugin description and a local pending map to call planResidentCheckEntries, bufferResidentCheckEntryRequests and takeResidentCheckEntryRequest. No resident process, native binary or file is involved.
 */
export const test_resident_check_planning_preserves_duplicate_entry_buffers =
  (): void => {
    const plugin = {
      binary: "/virtual/plugin",
      capabilities: { residentCheck: true },
      config: { transform: "@ttsc/lint" },
      kind: "executable",
      name: "@ttsc/lint",
      source: "/virtual/plugin-source",
      stage: "check",
    } as const;
    const args = [
      "check",
      "--tsconfig=/virtual/tsconfig.json",
      '--plugins-json=[{"name":"@ttsc/lint","stage":"check"},{"name":"@ttsc/lint","stage":"check"}]',
      "--cwd=/virtual",
    ];
    const checks = planResidentCheckEntries([plugin, { ...plugin }], () => [
      ...args,
    ]);

    assert.equal(checks.length, 2);
    assert.deepEqual(
      checks.map((check) => check.entryIndex),
      [0, 1],
    );
    assert.deepEqual(checks[0]!.args, checks[1]!.args);
    assert.notEqual(checks[0]!.key, undefined);
    assert.equal(checks[0]!.key, checks[1]!.key);

    const pending: Parameters<typeof bufferResidentCheckEntryRequests>[0] =
      new Map();
    const initial = {
      changed: ["/virtual/src/initial.ts"],
      external: ["/virtual/spec/initial.md"],
    };
    bufferResidentCheckEntryRequests(pending, checks, initial);
    assert.deepEqual(takeResidentCheckEntryRequest(pending, 0), initial);
    assert.equal(
      pending.has(1),
      true,
      "a first-entry short circuit must retain the second entry's delta",
    );

    const next = {
      changed: ["/virtual/src/next.ts"],
      external: ["/virtual/spec/next.md"],
    };
    bufferResidentCheckEntryRequests(pending, checks, next);
    assert.deepEqual(takeResidentCheckEntryRequest(pending, 0), next);
    assert.deepEqual(takeResidentCheckEntryRequest(pending, 1), {
      changed: [...initial.changed, ...next.changed],
      external: [...initial.external, ...next.external],
    });
    assert.equal(pending.size, 0);
    assert.throws(() => takeResidentCheckEntryRequest(pending, 1), /entry 1 has no buffered request/);
    bufferResidentCheckEntryRequests(pending, checks, { changed: ["/virtual/src/once.ts"], invalidate: true });
    bufferResidentCheckEntryRequests(pending, checks, { changed: ["/virtual/src/once.ts"], invalidate: false });
    assert.deepEqual(takeResidentCheckEntryRequest(pending, 0), {
      changed: ["/virtual/src/once.ts"],
      invalidate: true,
    }, "duplicate paths collapse and prior invalidation remains sticky");
    assert.deepEqual(takeResidentCheckEntryRequest(pending, 1), {
      changed: ["/virtual/src/once.ts"],
      invalidate: true,
    });
    assert.notEqual(
      planResidentCheckEntries([plugin], () => [...args], '["--strict"]')[0]!.key,
      planResidentCheckEntries([plugin], () => [...args], '["--strict","false"]')[0]!.key,
      "forwarded compiler payload participates in process identity",
    );
  };
