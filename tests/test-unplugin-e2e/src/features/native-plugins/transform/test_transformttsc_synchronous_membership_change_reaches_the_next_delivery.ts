import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../internal/transform-project-cache/projectModules";

/**
 * Verifies samchon/ttsc#1272: a membership change made between two deliveries
 * is seen by the second one.
 *
 * This is what the mutation-settle barrier exists for. A write returns before
 * its watch event is applied, so a delivery that read the tracker's verdict
 * immediately would validate against a watcher that had not been told, and
 * serve a generation the new file already invalidated. The barrier used to be a
 * fixed wait guessing at that crossing; it is now the watcher's own
 * acknowledgement, and this case pins that the guarantee did not move with it.
 *
 * 1. Deliver one module so the generation is captured.
 * 2. Write a new source file into the project, synchronously.
 * 3. Deliver another module and assert the project was recompiled.
 *
 * @evidence contracts/testing.md#behavioral-verification New src/added.ts written immediately after first delivery makes second module delivery raise compile count one to two.
 * @evidence contracts/testing.md#independent-expectations Explicit write with no delay plus native run log distinguishes barrier guarantee from eventual event polling.
 * @evidence contracts/testing.md#distinguishing-cases Synchronous new root between persistent module requests.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_synchronous_membership_change_reaches_the_next_delivery is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for synchronous new root between persistent module requests. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: New src/added.ts written immediately after first delivery makes second module delivery raise compile count one to two. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_synchronous_membership_change_reaches_the_next_delivery(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 2 });
  const cache = createTtscTransformCache();
  const modules = projectModules(project.root);
  const options = resolveOptions();
  const deliver = async (file: string): Promise<void> => {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
    assert.ok(result, `expected transformed output for ${file}`);
  };

  await deliver(modules[0]!);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);

  fs.writeFileSync(
    path.join(project.root, "src", "added.ts"),
    'export const added: string = "PROBE";\n',
    "utf8",
  );
  await deliver(modules[1]!);

  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "a file created between two deliveries must reach the watcher before the second one validates",
  );
}
