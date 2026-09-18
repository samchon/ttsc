import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies samchon/ttsc#1304: a generation's non-error diagnostics are surfaced
 * once per pass, not once per delivered module.
 *
 * The diagnostics describe one compile of one program, so writing them per
 * delivery printed the same warning once per module and scaled the noise with
 * exactly the reuse the cache exists to provide. The envelope is re-published
 * with a `warning`-category diagnostic attached — the shape
 * `toCompilerTransformation` produces for a compile whose diagnostics carry no
 * `"error"` category, which is what `@ttsc/lint` emits for every rule below
 * error severity — because no fixture plugin produces one on its own.
 */
export async function test_transformttsc_reports_generation_diagnostics_once_per_pass(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 1 });
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
  const marker = "TTSC-TEST-PROJECT-WIDE-WARNING";
  const original = process.stderr.write.bind(process.stderr);
  let writes = 0;
  try {
    api.beginTtscTransformBuild(cache);
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

    api.beginTtscTransformBuild(cache);
    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      writes,
      1,
      `every module of one pass shares one generation, so its diagnostics belong to the pass; wrote ${writes} times for ${modules.length} modules`,
    );

    api.beginTtscTransformBuild(cache);
    for (const file of modules) {
      assert.ok(await deliver(file));
    }
    assert.equal(
      writes,
      2,
      "a later pass must surface the standing warning again, once",
    );
  } finally {
    (process.stderr as { write: unknown }).write = original;
    api.resetTtscTransformCache(cache);
  }
}
