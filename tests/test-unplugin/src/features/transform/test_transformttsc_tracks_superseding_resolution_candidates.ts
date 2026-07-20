import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies an in-process transform cache misses and the adapter registers a
 * watch input when only a higher-priority, formerly missing module candidate
 * appears between two transforms of the same source file.
 *
 * The cache cannot learn this change from the importer or tsconfig because both
 * remain byte-identical. It must preserve the compiler-provided missing path as
 * an input until the next transform observes the different resolution.
 *
 * 1. Transform once with the missing candidate recorded in the graph envelope.
 * 2. Create only that candidate and transform the unchanged source again.
 * 3. Assert the cache recompiles and the adapter registered the candidate.
 */
export const test_transformttsc_tracks_superseding_resolution_candidates =
  async () => {
    const root = TestUnpluginProject.createProject({
      plugins: [],
      source:
        'import { winner } from "./value";\nexport const value = winner;\n',
    });
    const tsconfig = path.join(root, "tsconfig.json");
    const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
    config.compilerOptions.allowJs = true;
    fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
    const file = TestUnpluginProject.mainFile(root);
    const candidate = path.join(root, "src", "value.ts");
    fs.writeFileSync(
      path.join(root, "src", "value.js"),
      "export function winner() {}\n",
      "utf8",
    );

    const { createTtscTransformCache, resolveOptions, transformTtsc } =
      await TestUnpluginRuntime.loadUnpluginApi();
    const cache = createTtscTransformCache();
    const watched: string[] = [];
    const first = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      resolveOptions({ project: tsconfig }),
      undefined,
      cache,
      { addWatchFile: (input: string) => watched.push(input) },
    );
    assert.equal(first, undefined);
    assert.ok(
      watched.includes(candidate),
      `missing higher-priority candidate from watch inputs: ${watched.join(", ")}`,
    );
    assert.equal(cache.size, 1);
    const firstGeneration = [...cache.values()][0];

    fs.writeFileSync(
      candidate,
      "export function winner(): void {}\n",
      "utf8",
    );
    const second = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      resolveOptions({ project: tsconfig }),
      undefined,
      cache,
    );
    assert.equal(second, undefined);
    assert.notStrictEqual(
      [...cache.values()][0],
      firstGeneration,
      "creating a superseding candidate must replace the cached generation",
    );
  };
