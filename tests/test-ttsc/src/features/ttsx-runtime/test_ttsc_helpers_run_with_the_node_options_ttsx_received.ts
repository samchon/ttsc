import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtsxNodeOptions } from "../../../../../packages/ttsc/src/internal/TtsxNodeOptions";
import { javascriptRuntimeCapabilities } from "../../../../../packages/ttsc/src/internal/javascriptRuntimeCapabilities";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies ttsc's helper processes run with the `NODE_OPTIONS` a ttsx run
 * received, not with the preloads ttsx appended, and that a descendant which
 * set its own `NODE_OPTIONS` keeps it (samchon/ttsc#1740).
 *
 * Ttsx appends its runtime preloads to the program's `NODE_OPTIONS`. The
 * runtime capability probe and the descriptor evaluator refuse their caches for
 * any non-empty value, so inside a ttsx run every plugin load re-probed Node
 * and re-evaluated descriptors, each helper also running ttsx's preloads. The
 * record of the received value reaches every descendant of the program, so it
 * applies only while the value ttsx gave is still in force.
 *
 * 1. Assert the projections: the received value is restored while the given value
 *    holds, a nested run records the outermost received value, a descendant's
 *    own value is kept, and an environment without a record is unchanged.
 * 2. Probe Node with a recording preload given by a ttsx-like record over an empty
 *    received value: the preload must not run.
 * 3. Probe with that preload as the user's own received value: it runs on every
 *    probe, so the cache stays refused for a user preload.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual projections and the actual capability probe run a real Node child whose preload writes a file when it executes.
 * @evidence contracts/testing.md#independent-expectations Literal option strings and the presence and count of the preload's writes set every expectation.
 * @evidence contracts/testing.md#distinguishing-cases A record in force, a nested record, a descendant's own value, no record, ttsx-like preloads and a user's own preload are separate rows.
 * @evidence contracts/testing.md#execution-ownership Unit test: the projections and probe run in this process and spawn only the probe's own Node child; no ttsx run, plugin or compiler starts.
 */
export function test_ttsc_helpers_run_with_the_node_options_ttsx_received(): void {
  const given = TtsxNodeOptions.give(
    { NODE_OPTIONS: "--user" },
    "--user --ttsx",
  );
  assert.equal(given.NODE_OPTIONS, "--user --ttsx");
  assert.equal(TtsxNodeOptions.received(given), "--user");
  assert.equal(TtsxNodeOptions.forHelpers(given).NODE_OPTIONS, "--user");
  const nested = TtsxNodeOptions.give(given, "--user --ttsx --ttsx");
  assert.equal(
    TtsxNodeOptions.received(nested),
    "--user",
    "a nested run records the outermost received value",
  );
  const descendant = { ...given, NODE_OPTIONS: "--descendant" };
  assert.equal(
    TtsxNodeOptions.forHelpers(descendant),
    descendant,
    "a descendant's own value reaches its helpers",
  );
  assert.equal(TtsxNodeOptions.received(descendant), "--descendant");
  const outside = { NODE_OPTIONS: "--user" };
  assert.equal(
    TtsxNodeOptions.forHelpers(outside),
    outside,
    "outside a ttsx run the environment is unchanged",
  );
  assert.equal(
    TtsxNodeOptions.forHelpers(TtsxNodeOptions.give({}, "--ttsx")).NODE_OPTIONS,
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
    TtsxNodeOptions.give({}, option),
    root,
  );
  assert.equal(ttsxLike.executable, path.resolve(process.execPath));
  assert.equal(runs(), 0, "ttsx's preloads do not run in the probe");

  for (let probe = 0; probe < 2; probe++)
    javascriptRuntimeCapabilities(
      process.execPath,
      TtsxNodeOptions.give({ NODE_OPTIONS: option }, option),
      root,
    );
  assert.equal(
    runs(),
    2,
    "a user's own preload reaches every probe, so it is never cached",
  );
}
