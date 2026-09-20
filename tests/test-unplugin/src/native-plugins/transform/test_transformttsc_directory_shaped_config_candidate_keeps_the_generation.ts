import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { samePhysicalPath } from "../../internal/paths/samePhysicalPath";
import { createNestedUtilityPluginProject } from "../../internal/transform-utility-plugin-config/createNestedUtilityPluginProject";

/**
 * Verifies a directory wearing a config file's name leaves the generation
 * reusable.
 *
 * The discovery walk rejects such a directory as a config, but it is not the
 * same observation as an absent path: the host-input contract records an
 * existing directory by a fixed directory-kind digest and its physical path.
 * The producer's digest and the consumer's are two independently maintained
 * constants, and the moment they disagree — or the walk reports the directory
 * as absent — every consumer compares a nil against a digest its own filesystem
 * keeps producing. That is not an invalidation but a permanent one: the
 * generation is refused on every delivery for the rest of its life, which is
 * the shape samchon/ttsc#1245 was filed for.
 *
 * 1. Compile through an outer config while a nearer `banner.config.json` candidate
 *    is a directory.
 * 2. Require that directory's digest and physical identity in a complete envelope,
 *    then deliver again and retain the same generation.
 * 3. Replace the directory with a real nearer config and require one new
 *    generation with the nearer banner.
 * 4. Deliver once more and retain that replacement generation.
 */
export async function test_transformttsc_directory_shaped_config_candidate_keeps_the_generation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { middle, root } = createNestedUtilityPluginProject({
    outerConfig: JSON.stringify({ text: "OUTER BANNER" }),
    plugin: "banner",
    source: 'export const value: string = "kept";\n',
  });
  // One level nearer than the config the walk settles on. The search rejects
  // the directory on its way outward, and replacing it with a file must later
  // supersede the outer config rather than merely change an inert neighbour.
  const directory = path.join(middle, "banner.config.json");
  fs.mkdirSync(directory, { recursive: true });

  const file = path.join(root, "src", "main.ts");
  const source = fs.readFileSync(file, "utf8");
  const cache = createTtscTransformCache();
  const first = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /OUTER BANNER/);
  const firstGeneration = [...cache.values()][0];
  const cached = (await firstGeneration!) as {
    projectSnapshotComplete?: boolean;
    result?: {
      hostInputHashes?: Record<string, string | null>;
      hostInputRealpaths?: Record<string, string | null>;
      hostInputs?: string[];
    };
  };
  const absoluteDirectory = path.resolve(directory);
  assert.ok(
    cached.result?.hostInputs?.some((input) =>
      samePhysicalPath(input, directory),
    ),
    `the directory-shaped candidate is missing from the envelope: ${JSON.stringify(cached.result?.hostInputs ?? [])}`,
  );
  assert.equal(
    Object.entries(cached.result?.hostInputHashes ?? {}).find(([input]) =>
      samePhysicalPath(input, absoluteDirectory),
    )?.[1],
    crypto
      .createHash("sha256")
      .update("ttsc:host-input:directory\0")
      .digest("hex"),
    "the directory-shaped candidate must carry the directory-kind digest",
  );
  assert.equal(
    Object.entries(cached.result?.hostInputRealpaths ?? {}).find(([input]) =>
      samePhysicalPath(input, absoluteDirectory),
    )?.[1],
    fs.realpathSync.native(directory),
    "descriptor and linked-host observations must agree on the physical directory",
  );
  assert.equal(
    cached.projectSnapshotComplete,
    true,
    "the directory-shaped candidate must leave a reusable generation snapshot",
  );

  const second = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(second);
  assert.equal(
    [...cache.values()][0],
    firstGeneration,
    "a directory wearing a config name must not make the generation unreusable",
  );
  assert.match(second.code, /OUTER BANNER/);

  fs.rmSync(directory, { recursive: true });
  fs.writeFileSync(
    directory,
    JSON.stringify({ text: "NEARER BANNER" }),
    "utf8",
  );
  const third = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(third);
  const replacementGeneration = [...cache.values()][0];
  assert.notEqual(
    replacementGeneration,
    firstGeneration,
    "replacing the directory candidate with a config file must replace the generation",
  );
  assert.match(third.code, /NEARER BANNER/);
  assert.doesNotMatch(third.code, /OUTER BANNER/);

  const fourth = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(fourth);
  assert.equal(
    [...cache.values()][0],
    replacementGeneration,
    "the replacement config must compile exactly one new reusable generation",
  );
  assert.match(fourth.code, /NEARER BANNER/);
}
