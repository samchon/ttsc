import assert from "node:assert/strict";

import { RuntimeEntrySources } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeEntrySources";
import type { RuntimeManifest } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeManifest";

/**
 * Verifies a repeated serve of one checked entry build's emitted file reuses
 * its first served source, while another file or another build is prepared on
 * its own (samchon/ttsc#1749).
 *
 * Node 22.15 calls the `load` hook twice for the process entry, and ttsx read
 * and source-mapped the same emitted file again for the second call. A checked
 * entry build's emit is immutable for the run, so the first preparation answers
 * both. The same path under another build is that build's own emit.
 *
 * 1. Serve one build's emitted file twice: the preparation runs once and both
 *    calls return its source.
 * 2. Serve another emitted file of that build: its own preparation runs.
 * 3. Serve the first path under another build: its own preparation runs.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual accessor is called with counting preparations; the returned sources and the counts are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations Distinct authored source objects identify which preparation answered.
 * @evidence contracts/testing.md#distinguishing-cases A repeated file, a second file of the build and the same path under a second build are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit calls the in-process accessor with build objects no other case holds; no loader hook, file or process is involved.
 */
export function test_runtime_entry_sources_prepare_each_entry_once(): void {
  const build = (): RuntimeManifest => ({
    depCacheDir: "/ttsc-runtime-entry-sources/deps",
    emitDir: "/ttsc-runtime-entry-sources/emit",
    emittedSources: {},
    projectRoot: "/ttsc-runtime-entry-sources",
    rootDir: "/ttsc-runtime-entry-sources",
  });
  const first = build();
  const second = build();
  const main = "/ttsc-runtime-entry-sources/emit/main.js";
  const util = "/ttsc-runtime-entry-sources/emit/util.js";
  let prepared = 0;
  const prepare = (label: string) => () => {
    prepared++;
    return { label };
  };

  const served = RuntimeEntrySources.serve(first, main, prepare("main"));
  const again = RuntimeEntrySources.serve(first, main, prepare("main again"));
  assert.equal(prepared, 1, "a repeated serve prepares nothing");
  assert.equal(again, served, "the repeated serve gets the first source");
  assert.deepEqual(served, { label: "main" });

  const other = RuntimeEntrySources.serve(first, util, prepare("util"));
  assert.equal(prepared, 2, "another emitted file is prepared on its own");
  assert.deepEqual(other, { label: "util" });

  const rebuilt = RuntimeEntrySources.serve(second, main, prepare("rebuilt"));
  assert.equal(prepared, 3, "another build's emit is prepared on its own");
  assert.deepEqual(rebuilt, { label: "rebuilt" });
}
