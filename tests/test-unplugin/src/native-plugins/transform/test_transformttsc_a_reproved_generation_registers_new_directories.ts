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
