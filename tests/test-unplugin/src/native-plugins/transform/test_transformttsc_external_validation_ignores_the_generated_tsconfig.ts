import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { cacheEntry } from "../../internal/transform-external/cacheEntry";
import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies compiler scratch never joins the validation universe, even when the
 * temp root sits inside the project.
 *
 * A `compilerOptions` overlay compiles through a generated tsconfig that the
 * host's config chain reports and that is deleted right after the compile.
 * Hashing it would flip to missing on the first revalidation and turn every
 * later transform into a recompile. That must hold when the operating-system
 * temp root is inside the project, directly or through an alias, and without
 * masking a real descriptor or config edit.
 *
 * 1. Point `TEMP`, `TMP`, and `TMPDIR` at a project directory through a link (a
 *    junction on Windows), and transform with an overlay.
 * 2. Assert the generation is complete and records its temporary tsconfig, an
 *    unchanged retransform reuses it, a real edit replaces it, and the same
 *    reuse holds without an overlay.
 * 3. Point the temp variables at an alias of an outside directory, and assert the
 *    temporary tsconfig lands in that directory's physical path.
 */
export async function test_transformttsc_external_validation_ignores_the_generated_tsconfig(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const projectTemp = path.join(root, ".project-temp");
  fs.mkdirSync(projectTemp, { recursive: true });
  const aliasRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-project-temp-alias-"),
  );
  const aliasedProjectTemp = path.join(aliasRoot, "temp");
  fs.symlinkSync(
    projectTemp,
    aliasedProjectTemp,
    process.platform === "win32" ? "junction" : "dir",
  );
  const canonicalTemp = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-canonical-temp-"),
  );
  const canonicalTempAlias = path.join(aliasRoot, "canonical-temp");
  fs.symlinkSync(
    canonicalTemp,
    canonicalTempAlias,
    process.platform === "win32" ? "junction" : "dir",
  );
  const previousTemp = {
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
  };
  process.env.TEMP = aliasedProjectTemp;
  process.env.TMP = aliasedProjectTemp;
  process.env.TMPDIR = aliasedProjectTemp;
  const options = resolveOptions({
    compilerOptions: { removeComments: true },
    plugins: emitGraphPlugins({
      echoTsconfig: true,
      edges: { "src/main.ts": ["src/types.d.ts"] },
    }),
  });
  const cache = createTtscTransformCache();

  try {
    const before = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
    );
    assert.ok(before);
    assert.strictEqual(process.env.TEMP, aliasedProjectTemp);
    assert.strictEqual(process.env.TMP, aliasedProjectTemp);
    assert.strictEqual(process.env.TMPDIR, aliasedProjectTemp);
    const generation = cacheEntry(cache);
    const cached = (await generation) as {
      projectSnapshotComplete?: boolean;
      temporaryTsconfig?: string;
    };
    assert.strictEqual(cached.projectSnapshotComplete, true);
    assert.ok(cached.temporaryTsconfig);
    const relativeTemporaryTsconfig = path.relative(
      root,
      cached.temporaryTsconfig,
    );
    assert.ok(
      relativeTemporaryTsconfig === ".." ||
        relativeTemporaryTsconfig.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeTemporaryTsconfig),
    );

    const after = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
    );
    assert.ok(after);
    assert.strictEqual(cacheEntry(cache), generation);

    fs.appendFileSync(path.join(root, "plugin.cjs"), "\n// host edit\n");
    const changed = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
    );
    assert.ok(changed);
    assert.notStrictEqual(cacheEntry(cache), generation);

    process.env.TEMP = projectTemp;
    process.env.TMP = projectTemp;
    process.env.TMPDIR = projectTemp;
    const passthroughOptions = resolveOptions({
      plugins: emitGraphPlugins({
        echoTsconfig: true,
        edges: { "src/main.ts": ["src/types.d.ts"] },
      }),
    });
    const passthroughCache = createTtscTransformCache();
    const passthroughBefore = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      passthroughOptions,
      undefined,
      passthroughCache,
    );
    assert.ok(passthroughBefore);
    const passthroughGeneration = cacheEntry(passthroughCache);
    const passthroughCached = (await passthroughGeneration) as {
      projectSnapshotComplete?: boolean;
      temporaryTsconfig?: string;
    };
    assert.strictEqual(passthroughCached.projectSnapshotComplete, true);
    assert.strictEqual(passthroughCached.temporaryTsconfig, undefined);

    const passthroughAfter = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      passthroughOptions,
      undefined,
      passthroughCache,
    );
    assert.ok(passthroughAfter);
    assert.strictEqual(cacheEntry(passthroughCache), passthroughGeneration);

    process.env.TEMP = canonicalTempAlias;
    process.env.TMP = canonicalTempAlias;
    process.env.TMPDIR = canonicalTempAlias;
    const overlayCache = createTtscTransformCache();
    const canonicalOverlay = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      overlayCache,
    );
    assert.ok(canonicalOverlay);
    const canonicalOverlayCached = (await cacheEntry(overlayCache)) as {
      temporaryTsconfig?: string;
    };
    assert.ok(canonicalOverlayCached.temporaryTsconfig);
    assert.strictEqual(
      path.dirname(path.dirname(canonicalOverlayCached.temporaryTsconfig)),
      fs.realpathSync.native(canonicalTemp),
    );
  } finally {
    for (const [name, value] of Object.entries(previousTemp)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.unlinkSync(aliasedProjectTemp);
    fs.unlinkSync(canonicalTempAlias);
    fs.rmdirSync(aliasRoot);
    fs.rmSync(canonicalTemp, { force: true, recursive: true });
  }
}
