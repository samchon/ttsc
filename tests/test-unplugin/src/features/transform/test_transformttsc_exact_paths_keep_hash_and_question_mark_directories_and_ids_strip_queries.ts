import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import { createTransformCacheKey } from "../../../../../packages/unplugin/src/core/transform/cache/createTransformCacheKey";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { transformTtsc } from "../../../../../packages/unplugin/src/core/transform/transformTtsc";
import { TestProject } from "../../../../utils/src/TestProject";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies `transformTtsc` with `exactPath` selects the project of a file whose
 * directory name contains `#` or `?`, and without it a query still comes off a
 * module id.
 *
 * Hosts that join the query to the path in one id cannot tell it from a `?` or
 * `#` in a directory name, so the id is stripped at the first delimiter. esbuild,
 * Bun and the webpack-style loader context hand the file's own path, so their
 * adapters pass `exactPath` and the path must reach project selection untouched.
 * Stripping `.../C#/src/mod0.ts` at the `#` would look the project up from the
 * parent directory, and the module would be left untransformed.
 *
 * 1. Plant a decoy tsconfig at the root and a project below each of `C#`, a
 *    plain directory and, where the filesystem allows it, one containing `?`.
 * 2. Seed a cached generation per project under the key of its own tsconfig.
 * 3. Deliver each file with `exactPath` and require the generation's output; then
 *    deliver the plain project's file with a `?t=1` suffix and without
 *    `exactPath`, and a `?raw` wrapper, to keep the module-id behavior.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls transformTtsc against recorded successful generations seeded under each project's own cache key; a delivery that selects another project misses the cache, so the exact literal output of the nearest tsconfig's generation proves which project was selected.
 * @evidence contracts/testing.md#independent-expectations The expected outputs are authored literals recorded per project in the seeded generations, and the decoy root tsconfig has no generation, so selection of the parent project could not yield them; the `?t=1` and `?raw` outcomes are the documented module-id behavior (strip a cache-busting query, leave a wrapper to the host).
 * @evidence contracts/testing.md#distinguishing-cases A `#` directory and a `?` directory under `exactPath` contrast with a plain directory whose module id carries `?t=1` without it, and with a `?raw` wrapper that is left to the host; the `?` directory is exercised only where the filesystem can create it.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the actual delivery coordinator over literal successful generation metadata and real resolver files; no compiler, contributor or product host is built. The native compile connection stays in the E2E generation entries. A filesystem that cannot create a `?` directory (Windows) skips that one project with a printed SKIPPED line and asserts nothing for it.
 */
export async function test_transformttsc_exact_paths_keep_hash_and_question_mark_directories_and_ids_strip_queries(): Promise<void> {
  const base = TestProject.tmpdir("ttsc-exact-path-unit-");
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
  const options = resolveOptions({});
  const source = 'export const value = goUpper("plugin");\n';
  try {
    fs.writeFileSync(
      path.join(base, "tsconfig.json"),
      '{"include":["decoy"]}',
      "utf8",
    );

    const seed = (directory: string, code: string): string | undefined => {
      const root = path.join(base, directory);
      try {
        TestProject.writeFiles(root, {
          "tsconfig.json": '{"include":["src"]}',
          "src/mod0.ts": source,
        });
      } catch {
        return undefined;
      }
      const tsconfig = path.join(root, "tsconfig.json");
      const observed = observeValidationUnitGeneration(root, {
        type: "success",
        typescript: { "src/mod0.ts": code },
      });
      observed.deliveryEpoch = 1;
      cache.set(
        createTransformCacheKey({
          aliasPaths: {},
          compilerOptions: options.compilerOptions,
          plugins: options.plugins,
          tsconfig,
        }),
        Promise.resolve(observed),
      );
      return path.join(root, "src", "mod0.ts");
    };
    const deliver = (id: string, exactPath?: true) =>
      transformTtsc(id, source, options, undefined, cache, {
        ...(exactPath ? { exactPath } : {}),
      });

    const hash = seed("C#", 'export const value = "HASH";\n');
    const plain = seed("plain", 'export const value = "PLAIN";\n');
    const question = seed("q?x", 'export const value = "QUESTION";\n');
    assert.ok(hash !== undefined && plain !== undefined);

    assert.equal(
      (await deliver(hash!, true))?.code,
      'export const value = "HASH";\n',
      "a file below a # directory selects that directory's own project",
    );
    assert.equal(
      (await deliver(plain!, true))?.code,
      'export const value = "PLAIN";\n',
      "a file below a plain directory selects its project",
    );
    if (question === undefined)
      console.log("SKIPPED the ? directory project: this filesystem cannot name it");
    else
      assert.equal(
        (await deliver(question, true))?.code,
        'export const value = "QUESTION";\n',
        "a file below a ? directory selects that directory's own project",
      );

    assert.equal(
      (await deliver(`${plain!}?t=1`))?.code,
      'export const value = "PLAIN";\n',
      "without exactPath a cache-busting query still comes off a module id",
    );
    assert.equal(
      await deliver(`${plain!}?raw`),
      undefined,
      "without exactPath a ?raw wrapper is left to the host",
    );
  } finally {
    resetTtscTransformCache(cache);
    fs.rmSync(base, { force: true, recursive: true });
  }
}
