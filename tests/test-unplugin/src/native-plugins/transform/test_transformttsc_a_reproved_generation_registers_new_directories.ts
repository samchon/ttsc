import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.mjs";
import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a host that asks for the project's root-file membership receives it
 * with every delivery, and that a generation re-proven by a later pass
 * registers a directory created since its capture (samchon/ttsc#1419).
 *
 * The compiler reports no listing of what `include` expands to, so the
 * membership is its own watch input: the project root, carrying the walk's
 * digest, directories, and policy. An empty directory holds no root file, so
 * creating one keeps the generation; the walk that proves it unchanged is the
 * one that knows the directory exists, and without adopting it a root file
 * created there later would reach no host channel that watches directories. A
 * host that does not ask, such as `@ttsc/metro`, receives no such input.
 *
 * 1. Deliver a module through a pass that asks for membership, and assert one
 *    `membership` input for the project root naming its source directory.
 * 2. Create an empty directory, open a pass, deliver again, and assert the project
 *    did not recompile, the digest held, and the new directory is registered.
 * 3. Deliver without asking and assert no membership input is registered.
 *
 * @evidence contracts/testing.md#behavioral-verification Host-requested membership produces one root input naming src; after an empty src/later appears, another pass keeps one capture and the same digest but registers that new directory. A host declining membership receives no membership input.
 * @evidence contracts/testing.md#independent-expectations An empty directory has no new source membership but must become an observation location for later files. Literal root/path inclusion, equal digest and independent run-log count distinguish state adoption without calculating the membership codec. The test does not add a later file to the empty directory.
 * @evidence contracts/testing.md#distinguishing-cases Requested versus declined membership and initial versus re-proven directory lists are separate decisions. Empty-directory creation must preserve generation identity while widening watch registration; actual source creation is covered elsewhere.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_reproved_generation_registers_new_directories in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution One createCacheProject and shared counting-sidecar artifact serve all three host requests through one cache. The later pass re-proves existing source membership instead of rebuilding; host membership is only a registration option and needs no new installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique project/log roots isolate the new directory. Every deliver call has a fresh registration array, avoiding previous-batch leakage; explicit pass boundaries precede re-proof. finally resets the cache and trackers, and TestProject owns paths through runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_reproved_generation_registers_new_directories; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_reproved_generation_registers_new_directories(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 1 });
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions();
  const module = projectModules(project.root)[0]!;
  const compiles = () =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;
  const deliver = async (membership: boolean) => {
    let registered: readonly TtscWatchInput[] = [];
    await api.transformTtsc(
      module,
      fs.readFileSync(module, "utf8"),
      options,
      undefined,
      cache,
      {
        addWatchFiles: (inputs: readonly TtscWatchInput[]) => {
          registered = inputs;
        },
        membership,
      },
    );
    return registered.filter(
      (input) => input.evidence?.state?.codec === "membership",
    );
  };
  const directoriesOf = (input: TtscWatchInput | undefined) =>
    input?.evidence?.state?.codec === "membership"
      ? input.evidence.state.directories.map((directory) =>
          path.relative(project.root, directory).replace(/\\/g, "/"),
        )
      : [];
  const digestOf = (input: TtscWatchInput | undefined) =>
    input?.evidence?.state?.codec === "membership"
      ? input.evidence.state.digest
      : undefined;
  try {
    api.beginTtscTransformBuild(cache);
    const first = await deliver(true);
    assert.equal(first.length, 1, "one membership input per delivery");
    assert.equal(first[0]!.file, project.root);
    assert.ok(directoriesOf(first[0]).includes("src"));
    assert.equal(compiles(), 1);

    fs.mkdirSync(path.join(project.root, "src", "later"));
    api.beginTtscTransformBuild(cache);
    const second = await deliver(true);
    assert.equal(compiles(), 1, "an empty directory keeps the generation");
    assert.equal(digestOf(second[0]), digestOf(first[0]));
    assert.ok(
      directoriesOf(second[0]).includes("src/later"),
      "the re-proven generation registers the directory created since",
    );

    assert.deepEqual(await deliver(false), [], "only a host that asks");
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
