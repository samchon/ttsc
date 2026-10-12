import assert from "node:assert/strict";

import { RuntimeEntrySources } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeEntrySources";

/**
 * Verifies a repeated load of one entry URL reuses its first served source, and
 * another entry is prepared on its own (samchon/ttsc#1749).
 *
 * Node 22.15 calls the `load` hook twice for the process entry, and ttsx
 * resolved, read and source-mapped the same emit again for the second call. An
 * entry's emit belongs to the run, so the first preparation answers both.
 *
 * 1. Serve one entry URL twice: the preparation runs once and both calls return
 *    its source.
 * 2. Serve a second entry URL: its own preparation runs.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual accessor is called with counting preparations; the returned sources and the counts are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations Distinct authored source objects identify which preparation answered.
 * @evidence contracts/testing.md#distinguishing-cases A repeated URL and a second URL are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit calls the in-process accessor with URLs no other case uses; no loader hook, file or process is involved.
 */
export function test_runtime_entry_sources_prepare_each_entry_once(): void {
  const first = "file:///ttsc-runtime-entry-sources/first.ts";
  const second = "file:///ttsc-runtime-entry-sources/second.ts";
  let prepared = 0;
  const prepare = (label: string) => () => {
    prepared++;
    return { label };
  };

  const served = RuntimeEntrySources.serve(first, prepare("first"));
  const again = RuntimeEntrySources.serve(first, prepare("first again"));
  assert.equal(prepared, 1, "a repeated entry load prepares nothing");
  assert.equal(again, served, "the repeated load gets the first source");
  assert.deepEqual(served, { label: "first" });

  const other = RuntimeEntrySources.serve(second, prepare("second"));
  assert.equal(prepared, 2, "another entry is prepared on its own");
  assert.deepEqual(other, { label: "second" });
}
