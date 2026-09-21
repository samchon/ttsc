import assert from "node:assert/strict";

import { registerBuildWatchInputs } from "../../../../../packages/unplugin/lib/core/bridge/registerBuildWatchInputs.js";
import type { TtscMissingWatchInputShape } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscMissingWatchInputShape.js";
import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.js";

/**
 * Verifies a build host's missing channel is told, beside each absent path,
 * what must appear there for the compiler's answer to change: a directory for a
 * directory probe, a file for a file probe, and either for a registration that
 * carries no evidence, such as the recovery inputs of a failed compile.
 *
 * Turbopack has no missing channel of its own. Its file channel reads the path,
 * and that read fails on a directory, which fails the module's evaluation and,
 * through Turbopack's worker pool, hands the next module this module's result.
 * The shape is what lets its loader keep a path that may come back as a
 * directory off the file channel; a host whose missing channel observes any
 * creation, webpack and Rspack, ignores it.
 *
 * 1. Register a `directoryExists` probe, a `fileExists` probe, and an absent path
 *    without evidence through webpack-style loader channels.
 * 2. Assert the missing channel received each with its shape, and nothing else
 *    reached the file or directory channel.
 */
export async function test_build_watch_inputs_tell_the_missing_channel_what_may_appear(): Promise<void> {
  const observed = (file: string, observation: object): TtscWatchInput => ({
    evidence: {
      identity: file,
      missing: false,
      state: { codec: "predicates", observation },
    },
    file,
  });
  const context: string[] = [];
  const file: string[] = [];
  const missing: [string, TtscMissingWatchInputShape][] = [];
  registerBuildWatchInputs({
    addWatchFile: (input) => file.push(input),
    file: "/p/src/main.ts",
    inputs: [
      observed("/p/src/deps", { directoryExists: false }),
      observed("/p/src/deps/local.ts", { fileExists: false }),
      { file: "/p/src/recovered" },
    ],
    loader: {
      addContextDependency: (input) => context.push(input),
      addDependency: (input) => file.push(input),
      addMissingDependency: (input, shape) => missing.push([input, shape]),
    },
    projectRoot: "/p",
  });
  assert.deepEqual(missing, [
    ["/p/src/deps", "directory"],
    ["/p/src/deps/local.ts", "file"],
    ["/p/src/recovered", "either"],
  ]);
  assert.deepEqual(context, [], "an absent path is not a listing");
  assert.deepEqual(file, [], "an absent path is not a file");
}
