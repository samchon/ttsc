import assert from "node:assert/strict";

import {
  bufferResidentCheckEntryRequests,
  planResidentCheckEntries,
  takeResidentCheckEntryRequest,
} from "../../../../../packages/ttsc/lib/compiler/internal/runBuild.js";

/**
 * Verifies duplicate resident check entries share a process, not pending state.
 *
 * A resident process is keyed by binary, plugin name, and native arguments. The
 * same configured entry may therefore execute twice through one process, while
 * each entry still needs its own complete filesystem-change stream.
 *
 * 1. Plan two identical synthetic check entries and require one shared key.
 * 2. Buffer one cycle, consume only the first entry, and simulate a failure.
 * 3. Buffer the next cycle and require the deferred entry to retain both
 *    transitions while the first entry receives only the new transition.
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
  };
