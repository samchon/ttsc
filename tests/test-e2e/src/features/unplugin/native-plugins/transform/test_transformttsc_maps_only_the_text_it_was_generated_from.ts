import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { originalPositionFor } from "../../../../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../../../../internal/unplugin/internal/source-map/positionOf";
import { createLinkedPluginProject } from "../../../../internal/unplugin/internal/transform-linked-completeness/createLinkedPluginProject";

/**
 * Verifies a transformed module carries a source map back to the delivered
 * text, and only when the map describes that text (samchon/ttsc#1392).
 *
 * The native host reprints every transformed file, so without a map a bundler
 * attributes each later position to the reprint. `@ttsc/banner` inserts a block
 * above the code, shifting every line. A map is also a claim about the text it
 * was generated from: a delivery that diverged from the disk the generation
 * compiled, which the generation still serves (samchon/ttsc#1394), must not
 * receive a map for other text. A host that supplies no map, such as an
 * executable sidecar, keeps returning code alone.
 *
 * 1. Transform a banner project's entry and assert the map names the entry by its
 *    absolute path, carries its text, and maps the printed `value` back to its
 *    authored line and column.
 * 2. Deliver text that differs from the disk and assert the module is still
 *    transformed, without a map.
 * 3. Transform through a sidecar host that supplies no maps and assert the code
 *    comes without one.
 *
 * @evidence contracts/testing.md#behavioral-verification Real banner source maps name source/text and map generated value back to authored coordinates; divergent delivered text receives code without map, and mapless sidecar receives code only.
 * @evidence contracts/testing.md#independent-expectations An independent source-map decoder and source position search establish expected location from authored text rather than adapter calculations.
 * @evidence contracts/testing.md#distinguishing-cases Matching delivered/disk text, divergent delivered text and a producer with no map are three distinct mapping permissions.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_maps_only_the_text_it_was_generated_from in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The real linked utility plugin reads consumer configuration and produces code, completeness, graph or source-map fields consumed by the built adapter. The asserted selection/output/registration cannot be established by an in-memory config or dependency-list unit alone.
 * @evidence contracts/e2e.md#shared-execution The utility fixture seeds the workspace plugin package and shares the native Go build cache; each distinct plugin/contributor set retains its own content-keyed host artifact. This case reuses its consumer and cache across configuration/content transitions where supplied; changed config options are inputs, not repeated package installations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup. The stderr hook is restored in finally.
 * @evidence contracts/e2e.md#preserved-coverage Real banner source maps name source/text and map generated value back to authored coordinates; divergent delivered text receives code without map, and mapless sidecar receives code only. These assertions remain in test_transformttsc_maps_only_the_text_it_was_generated_from, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_maps_only_the_text_it_was_generated_from(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createLinkedPluginProject(["banner"]);
  const source = fs.readFileSync(project.main, "utf8");

  const result = await transformTtsc(
    project.main,
    source,
    resolveOptions(),
    undefined,
    undefined,
  );
  assert.ok(result?.map, "a reprinted module carries a source map");
  const module = project.main.replace(/\\/g, "/");
  assert.deepEqual(result.map.sources, [module]);
  assert.deepEqual(result.map.sourcesContent, [source]);
  const generated = positionOf(result.code, "value");
  const authored = positionOf(source, "value");
  assert.ok(
    generated.line > authored.line,
    "the banner shifts the declaration down",
  );
  assert.deepEqual(
    originalPositionFor(result.map, generated.line, generated.column),
    { ...authored, source: module },
  );

  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  let divergent;
  try {
    divergent = await transformTtsc(
      project.main,
      `${source}// delivered by an earlier plugin\n`,
      resolveOptions(),
      undefined,
      undefined,
    );
  } finally {
    process.stderr.write = write;
  }
  assert.ok(divergent, "the divergent delivery is still transformed");
  assert.equal(
    divergent.map,
    undefined,
    "a map of the disk text is not a map of the delivered text",
  );

  const root = TestUnpluginProject.createProject();
  const sidecar = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
    undefined,
    undefined,
  );
  assert.ok(sidecar);
  TestUnpluginProject.assertTransformedToPlugin(sidecar.code);
  assert.equal("map" in sidecar, false, "a host without maps claims none");
}
