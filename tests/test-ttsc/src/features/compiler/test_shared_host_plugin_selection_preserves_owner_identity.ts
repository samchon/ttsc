import assert from "node:assert/strict";

import { selectSharedHostPlugin } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/selectSharedHostPlugin";
import type { ITtscLoadedNativePlugin } from "../../../../../packages/ttsc/src/structures/internal/ITtscLoadedNativePlugin";

/**
 * Selects an existing owner from the ordered shared compiler-pass population.
 *
 * Executable transforms take precedence over earlier linked transforms; an
 * all-linked population uses its first descriptor. Selection preserves identity
 * and caller-owned records rather than manufacturing another host descriptor.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual selectSharedHostPlugin with full typed descriptors and observes exact selected-object identity, the empty-population error and unchanged input arrays and DTO values.
 * @evidence contracts/testing.md#independent-expectations Literal ordered populations require the first executable, the first of two linked transforms or the sole executable. Empty input requires the exact documented setup error; expected descriptors are authored references, not another implementation of the search.
 * @evidence contracts/testing.md#distinguishing-cases An earlier linked transform cannot displace the first of two executable owners, all-linked fallback retains first identity, a singleton remains itself and empty input cannot imply a default host. Independent named observations retain array order, descriptor references and pre-call DTO contents even when selection fails.
 * @evidence contracts/testing.md#execution-ownership This source unit directly imports the owning selector and supplies ordinary loaded-plugin DTO data without casts, filesystem fixtures, child processes, installed consumers, foreign patches or native artifacts. Binary/source strings are descriptor data only; no loading or dispatch is exercised.
 */
export function test_shared_host_plugin_selection_preserves_owner_identity(): void {
  const descriptor = (
    name: string,
    kind: ITtscLoadedNativePlugin["kind"],
  ): ITtscLoadedNativePlugin => ({
    binary: `${name}-host`,
    config: { transform: name, enabled: true, label: name },
    kind,
    name,
    source: `${name}-source`,
    stage: "transform",
  });
  const linkedFirst = descriptor("linked-first", "linked");
  const linkedSecond = descriptor("linked-second", "linked");
  const executableFirst = descriptor("executable-first", "executable");
  const executableSecond = descriptor("executable-second", "executable");
  const rows: readonly {
    name: string;
    plugins: ITtscLoadedNativePlugin[];
    expected: ITtscLoadedNativePlugin | undefined;
  }[] = [
    {
      name: "first executable wins over earlier linked owner",
      plugins: [linkedFirst, executableFirst, executableSecond],
      expected: executableFirst,
    },
    {
      name: "all-linked first-owner fallback",
      plugins: [linkedFirst, linkedSecond],
      expected: linkedFirst,
    },
    {
      name: "sole executable retains identity",
      plugins: [executableSecond],
      expected: executableSecond,
    },
    { name: "empty population rejects", plugins: [], expected: undefined },
  ];
  const failures: Error[] = [];
  const observe = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  for (const row of rows) {
    const original = [...row.plugins];
    const contents = JSON.stringify(row.plugins);
    observe(row.name, () => {
      if (row.expected === undefined)
        assert.throws(() => selectSharedHostPlugin(row.plugins), {
          message: "ttsc: a shared compiler pass requires at least one plugin",
        });
      else assert.equal(selectSharedHostPlugin(row.plugins), row.expected);
    });
    observe(`${row.name}: caller population remains unchanged`, () => {
      assert.equal(row.plugins.length, original.length);
      for (const [index, plugin] of original.entries())
        assert.equal(row.plugins[index], plugin);
      assert.equal(JSON.stringify(row.plugins), contents);
    });
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "shared host selection observations failed");
}
