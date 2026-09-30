import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { declareComplete } from "../../internal/transform-complete/declareComplete";
import { cacheEntry } from "../../internal/transform-external/cacheEntry";
import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies a completeness declaration narrows persistent cache validation as
 * well as watch registration.
 *
 * A plugin that declares a file's dependency list complete takes ownership of
 * that set. An undeclared graph member must then stop imposing whole-envelope
 * reads on every delivery, just as it stops being registered for watching.
 *
 * 1. Transform an entry whose graph edges to an external declaration, with the
 *    entry declared complete and no dependencies reported.
 * 2. Change the external declaration.
 * 3. Transform again and assert the same cached generation is served.
 *
 * @evidence contracts/testing.md#behavioral-verification A complete entry with no declared dependencies reuses the identical generation after an otherwise reachable external declaration changes.
 * @evidence contracts/testing.md#independent-expectations The synthetic plugin explicitly declares main complete and supplies its graph edge; empty owned dependencies independently define the narrower bound.
 * @evidence contracts/testing.md#distinguishing-cases Complete entry ignores undeclared external graph content; incomplete-host-bound invalidation remains covered by graph-edge cases.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_completeness_narrows_persistent_cache_validation in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage A complete entry with no declared dependencies reuses the identical generation after an otherwise reachable external declaration changes. These assertions remain in test_transformttsc_completeness_narrows_persistent_cache_validation, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_completeness_narrows_persistent_cache_validation(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const shared = TestProject.tmpdir("ttsc-unplugin-external-");
  const external = path.join(shared, "types.d.ts");
  fs.writeFileSync(external, "declare const first: string;\n", "utf8");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external).split(path.sep).join("/");
  const options = resolveOptions({
    plugins: [
      ...emitGraphPlugins({ edges: { "src/main.ts": [relative] } }),
      declareComplete(["src/main.ts"]),
    ],
  });
  const cache = createTtscTransformCache();

  const before = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(before);
  const generation = cacheEntry(cache);

  fs.writeFileSync(external, "declare const second: string;\n", "utf8");
  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.strictEqual(cacheEntry(cache), generation);
}
