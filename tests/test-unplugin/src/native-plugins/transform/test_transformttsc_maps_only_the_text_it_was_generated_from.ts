import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { originalPositionFor } from "../../internal/source-map/originalPositionFor";
import { positionOf } from "../../internal/source-map/positionOf";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";

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
  assert.equal(sidecar.map, undefined, "a host without maps claims none");
}
