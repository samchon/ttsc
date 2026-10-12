import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtsxNodeOptions } from "../../../../../packages/ttsc/src/internal/TtsxNodeOptions";
import { javascriptRuntimeCapabilities } from "../../../../../packages/ttsc/src/internal/javascriptRuntimeCapabilities";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies ttsc's helper processes run with the `NODE_OPTIONS` a ttsx run
 * received, not with the preloads ttsx appended (samchon/ttsc#1740).
 *
 * Ttsx appends its runtime preloads to the program's `NODE_OPTIONS`. The
 * runtime capability probe and the descriptor evaluator refuse their caches for
 * any non-empty value, so inside a ttsx run every plugin load re-probed Node
 * and re-evaluated descriptors, each helper also running ttsx's preloads.
 *
 * 1. Assert the received record keeps an outer run's value and otherwise takes
 *    this process's, and that the helper projection restores it only inside a
 *    ttsx run.
 * 2. Probe Node with a recording preload in `NODE_OPTIONS` and an empty received
 *    value: the preload must not run.
 * 3. Probe with that preload as the user's own received value: it runs on every
 *    probe, so the cache stays refused for a user preload.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual projection and the actual capability probe run a real Node child whose preload writes a file when it executes.
 * @evidence contracts/testing.md#independent-expectations Literal option strings and the presence and count of the preload's writes set every expectation.
 * @evidence contracts/testing.md#distinguishing-cases An outer record, no record, an empty received value with ttsx-like preloads, and a user's own preload are separate rows.
 * @evidence contracts/testing.md#execution-ownership Unit test: the projection and probe run in this process and spawn only the probe's own Node child; no ttsx run, plugin or compiler starts.
 */
export function test_ttsc_helpers_run_with_the_node_options_ttsx_received(): void {
  assert.equal(
    TtsxNodeOptions.received({
      NODE_OPTIONS: "--require ttsx",
      [TtsxNodeOptions.RECEIVED]: "--user",
    }),
    "--user",
    "an inner run keeps the outer run's record",
  );
  assert.equal(TtsxNodeOptions.received({ NODE_OPTIONS: "--user" }), "--user");
  assert.equal(TtsxNodeOptions.received({}), "");
  const outside = { NODE_OPTIONS: "--user" };
  assert.equal(
    TtsxNodeOptions.forHelpers(outside),
    outside,
    "outside a ttsx run the environment is unchanged",
  );
  assert.equal(
    TtsxNodeOptions.forHelpers({
      NODE_OPTIONS: "--require ttsx",
      [TtsxNodeOptions.RECEIVED]: "",
    }).NODE_OPTIONS,
    undefined,
  );

  const root = TestProject.tmpdir("ttsc-helper-node-options-");
  const marks = path.join(root, "marks");
  fs.mkdirSync(marks);
  const preload = path.join(root, "preload.cjs");
  fs.writeFileSync(
    preload,
    `require("node:fs").writeFileSync(require("node:path").join(${JSON.stringify(marks)}, String(process.pid)), "");\n`,
  );
  const option = `--require ${JSON.stringify(preload)}`;
  const runs = () => fs.readdirSync(marks).length;

  const ttsxLike = javascriptRuntimeCapabilities(
    process.execPath,
    { NODE_OPTIONS: option, [TtsxNodeOptions.RECEIVED]: "" },
    root,
  );
  assert.equal(ttsxLike.executable, path.resolve(process.execPath));
  assert.equal(runs(), 0, "ttsx's preloads do not run in the probe");

  for (let probe = 0; probe < 2; probe++)
    javascriptRuntimeCapabilities(
      process.execPath,
      { NODE_OPTIONS: option, [TtsxNodeOptions.RECEIVED]: option },
      root,
    );
  assert.equal(
    runs(),
    2,
    "a user's own preload reaches every probe, so it is never cached",
  );
}
