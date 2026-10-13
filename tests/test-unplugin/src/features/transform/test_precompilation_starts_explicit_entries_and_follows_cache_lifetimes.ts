import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { TtscPrecompilation } from "../../../../../packages/unplugin/src/core/transform/TtscPrecompilation";
import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies explicit entries start together and startup ownership follows the
 * host cache.
 *
 * A host may discover workspace imports sequentially. The scheduler must enter
 * every selected capture before any pending capture completes, retain native
 * entry text and preserve source eligibility.
 *
 * 1. Write native source entries and start captures held behind one gate.
 * 2. Require parallel entry, lexical deduplication and unchanged source text.
 * 3. Change cwd, aliases, options and the delivery pass, then reset ownership and
 *    require a fresh batch while ordinary repeated requests remain shared.
 * 4. Exercise disabled, missing and failing entries without an unhandled rejection
 *    or a successful result invented for their failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the real precompilation scheduler with its supported capture callback and native files. Captures record entry before an unresolved gate and settlement after it; assertions require both selected sources to enter first, exact source text, no excluded entries and new batches at actual context/reset boundaries.
 * @evidence contracts/testing.md#independent-expectations Authored paths and source strings determine eligibility and content. An independently controlled unresolved promise establishes overlap without timing thresholds; expected batch counts follow public scheduling and cache lifecycle boundaries rather than compiler output.
 * @evidence contracts/testing.md#distinguishing-cases Covers empty/absent/disabled selection, duplicate dot-segment and relative paths, declarations, JavaScript, node_modules, virtual IDs, missing files, failing captures, cwd/option/alias/epoch changes and reset. Identical relative options in two actual working directories must capture each directory's own bytes; same-cwd requests share and returning to an earlier cwd starts a fresh current batch. Native compilation proof, same-project Promise sharing and real adapter assembly belong to the precompilation E2E scenario.
 * @evidence contracts/testing.md#execution-ownership This discoverable direct-source unit exercises scheduling with an author-owned callback, creates no compiler/plugin artifact or product host, and restores the native working directory and removes its private files in finally. The scheduler owns rejection consumption; the test releases and joins every gated capture.
 */
export async function test_precompilation_starts_explicit_entries_and_follows_cache_lifetimes(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-precompile-scheduling-");
  const first = path.join(root, "first.ts");
  const second = path.join(root, "second.ts");
  fs.writeFileSync(first, "export const first = 1;\r\n");
  fs.writeFileSync(second, "export const second = 2;\n");
  const cache = createTtscTransformCache();
  const cwdCache = createTtscTransformCache();
  const originalCwd = process.cwd();
  const entries = [
    first,
    path.join(root, ".", "first.ts"),
    path.relative(process.cwd(), second),
    path.join(root, "missing.ts"),
    path.join(root, "types.d.ts"),
    path.join(root, "plain.js"),
    path.join(root, "node_modules", "dependency.ts"),
    "\0virtual.ts",
  ];
  const options = resolveOptions({ precompile: entries });
  entries.push(path.join(root, "after-normalization.ts"));
  assert.equal(options.precompile?.length, 8);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered: { file: string; source: string }[] = [];
  const settled: string[] = [];
  const captures: Promise<void>[] = [];
  const capture = (file: string, source: string): Promise<void> => {
    entered.push({ file, source });
    const pending = gate.then(() => {
      settled.push(file);
    });
    captures.push(pending);
    return pending;
  };
  try {
    TtscPrecompilation.start(cache, resolveOptions(), undefined, capture);
    TtscPrecompilation.start(
      cache,
      resolveOptions({ precompile: [] }),
      undefined,
      capture,
    );
    TtscPrecompilation.start(
      cache,
      { ...options, plugins: false },
      undefined,
      capture,
    );
    assert.equal(entered.length, 0);
    TtscPrecompilation.start(cache, options, undefined, capture);
    assert.deepEqual(entered, [
      { file: first, source: "export const first = 1;\r\n" },
      { file: second, source: "export const second = 2;\n" },
    ]);
    assert.deepEqual(
      settled,
      [],
      "both captures must start before either finishes",
    );
    TtscPrecompilation.start(cache, options, undefined, capture);
    assert.equal(entered.length, 2);
    TtscPrecompilation.start(cache, options, { "@entry": [root] }, capture);
    assert.equal(
      entered.length,
      4,
      "changed aliases require a new scheduling context",
    );
    const changed = { ...options, compilerOptions: { strict: true } };
    TtscPrecompilation.start(cache, changed, { "@entry": [root] }, capture);
    assert.equal(entered.length, 6);
    beginTtscTransformBuild(cache);
    TtscPrecompilation.start(cache, changed, { "@entry": [root] }, capture);
    assert.equal(
      entered.length,
      8,
      "a new delivery pass must prepare its selected entries",
    );
    resetTtscTransformCache(cache);
    TtscPrecompilation.start(cache, changed, { "@entry": [root] }, capture);
    assert.equal(
      entered.length,
      10,
      "reset must release startup ownership too",
    );
    resetTtscTransformCache(cache);
    let failures = 0;
    TtscPrecompilation.start(cache, options, undefined, async () => {
      failures += 1;
      throw new Error("authored capture rejection");
    });
    await Promise.resolve();
    assert.equal(
      failures,
      2,
      "a failure must not prevent another entry from starting",
    );

    const directories = ["a", "b"].map((name) => path.join(root, name));
    for (const directory of directories) {
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, "entry.ts"), path.basename(directory));
    }
    const relativeOptions = resolveOptions({
      precompile: ["entry.ts", "./entry.ts"],
    });
    const coordinates: { file: string; source: string }[] = [];
    const startRelative = () => TtscPrecompilation.start(
      cwdCache, relativeOptions, undefined, async (file, source) => {
        coordinates.push({ file, source });
      },
    );
    process.chdir(directories[0]!);
    startRelative();
    startRelative();
    assert.deepEqual(coordinates, [{ file: path.join(directories[0]!, "entry.ts"), source: "a" }]);
    process.chdir(directories[1]!);
    startRelative();
    startRelative();
    assert.deepEqual(coordinates, [
      { file: path.join(directories[0]!, "entry.ts"), source: "a" },
      { file: path.join(directories[1]!, "entry.ts"), source: "b" },
    ], "relative entries must select the current cwd even when cache and options match");
    process.chdir(directories[0]!);
    startRelative();
    assert.equal(coordinates.length, 3);
    beginTtscTransformBuild(cwdCache);
    startRelative();
    startRelative();
    assert.equal(coordinates.length, 4, "a new epoch reopens the current cwd's batch");
    resetTtscTransformCache(cwdCache);
    startRelative();
    startRelative();
    assert.equal(coordinates.length, 5, "reset releases the current cwd's batch");
  } finally {
    process.chdir(originalCwd);
    release();
    await Promise.all(captures);
    resetTtscTransformCache(cache);
    resetTtscTransformCache(cwdCache);
    fs.rmSync(root, { recursive: true, force: true });
  }
}
