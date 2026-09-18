import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a host with no delivery pass surfaces a generation's diagnostics
 * once per generation.
 *
 * The guard is two fields rather than one because a persistent host's epoch is
 * `undefined`, which is also the initial value: collapsing them into a single
 * epoch comparison would silently suppress the very first report for Metro, the
 * Turbopack loader and a watching dev server. The rule is the same one the pass
 * uses, with one pass.
 */
export async function test_transformttsc_persistent_diagnostics_are_reported_once_per_generation(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 4, graphFanout: 1 });
  const modules = projectModules(project.root);
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions();
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const marker = "TTSC-TEST-PERSISTENT-WARNING";
  const original = process.stderr.write.bind(process.stderr);
  let writes = 0;
  try {
    // No `beginTtscTransformBuild` anywhere: this is the persistent lifecycle.
    assert.ok(await deliver(modules[0]!));
    const key = [...cache.keys()][0]!;
    const good = (await cache.get(key)) as Record<string, unknown>;
    cache.set(
      key,
      Promise.resolve({
        ...good,
        diagnosticsEpoch: undefined,
        diagnosticsReported: false,
        result: {
          ...(good.result as Record<string, unknown>),
          diagnostics: [
            {
              category: "warning",
              character: 1,
              file: "src/mod0.ts",
              line: 1,
              messageText: marker,
            },
          ],
        },
        servedFiles: new Set<string>(),
      }),
    );

    (process.stderr as { write: unknown }).write = (
      chunk: unknown,
      ...rest: unknown[]
    ) => {
      if (String(chunk).includes(marker)) writes += 1;
      return (original as (...args: unknown[]) => boolean)(chunk, ...rest);
    };

    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      writes,
      1,
      `a persistent host must surface one generation's diagnostics once; wrote ${writes} times for ${modules.length} deliveries`,
    );
  } finally {
    (process.stderr as { write: unknown }).write = original;
    api.resetTtscTransformCache(cache);
  }
}
