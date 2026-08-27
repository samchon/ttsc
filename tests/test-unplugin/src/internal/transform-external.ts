import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { emitGraphPlugins } from "./transform-graph";

/**
 * Scenarios for the out-of-walk cache validation
 * (`TtscCachedProjectTransform.externalInputHashes`, samchon/ttsc#721).
 *
 * The project-walk snapshot cannot see inputs outside the project root or under
 * ignored directories, yet the reference graph and the plugin-reported
 * dependencies prove they feed the transform. Hosts without a per-build cache
 * boundary (Metro workers and the Turbopack loader) keep one cache for the
 * process lifetime, so validation itself must re-hash those inputs.
 */

/** Create a project plus a transform input file outside its root. */
function createProjectWithExternalInput(content: string): {
  external: string;
  relative: string;
  root: string;
} {
  const shared = TestProject.tmpdir("ttsc-unplugin-external-");
  const external = path.join(shared, "helper.ts");
  fs.writeFileSync(external, content, "utf8");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  return {
    external,
    relative: path.relative(root, external).split(path.sep).join("/"),
    root,
  };
}

/** The single cached generation object, for cache-identity assertions. */
export function cacheEntry(cache: Map<string, unknown>): unknown {
  assert.equal(cache.size, 1);
  return [...cache.values()][0];
}

/**
 * Asserts a persistent cache invalidates when a reported out-of-walk input
 * changes: the plugin reads a file outside the project root and reports it as a
 * dependency; editing only that file must produce regenerated output from the
 * same cache instance (no `buildStart` clear in between).
 */
export async function assertCacheInvalidatesOnExternalInputChange(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { external, relative, root } =
    createProjectWithExternalInput("first\n");
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reader",
        operation: "read-configured-helper",
        path: relative,
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [relative],
      },
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
  assert.match(before.code, /PLUGIN:FIRST/);

  fs.writeFileSync(external, "second\n", "utf8");
  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.match(after.code, /PLUGIN:SECOND/);
}

/**
 * Asserts the negative twin: with the external input untouched, the second
 * transform replays the cached generation (same promise identity) instead of
 * recompiling — the external re-hash must not turn the cache into a per-call
 * recompile.
 */
export async function assertCacheReplaysWhenExternalInputsUnchanged(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const { relative, root } = createProjectWithExternalInput("first\n");
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "reader",
        operation: "read-configured-helper",
        path: relative,
      },
      {
        transform: "./plugin.cjs",
        name: "reporter",
        operation: "emit-dependencies",
        dependencies: [relative],
      },
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

  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.equal(after.code, before.code);
  assert.strictEqual(cacheEntry(cache), generation);
}

/**
 * Asserts invalidation flows through a reference-graph edge alone: the plugin
 * never reads the external file, only the host graph names it, so a content
 * edit is observable purely as a replaced cache generation.
 */
export async function assertCacheInvalidatesThroughExternalGraphEdge(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const shared = TestProject.tmpdir("ttsc-unplugin-external-");
  const external = path.join(shared, "types.d.ts");
  fs.writeFileSync(external, "declare const first: string;\n", "utf8");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external).split(path.sep).join("/");
  const options = resolveOptions({
    plugins: emitGraphPlugins({ edges: { "src/main.ts": [relative] } }),
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
  assert.notStrictEqual(cacheEntry(cache), generation);
}

/**
 * Asserts an in-root filesystem link remains outside the project-walk hash
 * universe and a same-content target retarget invalidates a cached generation.
 */
export async function assertCacheInvalidatesThroughLinkedGraphEdge(): Promise<void> {
  const {
    isProjectWalkPath,
    resolveOptions,
    transformTtsc,
    createTtscTransformCache,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const targetRoot = path.join(root, "targets");
  const firstTarget = path.join(targetRoot, "first");
  const secondTarget = path.join(targetRoot, "second");
  const declaration = "\ufeffdeclare const selected: string;\n";
  const compilerText = declaration.slice(1);
  fs.mkdirSync(firstTarget, { recursive: true });
  fs.mkdirSync(secondTarget);
  fs.writeFileSync(path.join(firstTarget, "types.d.ts"), declaration, "utf8");
  fs.writeFileSync(path.join(secondTarget, "types.d.ts"), declaration, "utf8");
  const linkedDirectory = path.join(root, "linked");
  fs.symlinkSync(
    firstTarget,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  const linked = path.join(linkedDirectory, "types.d.ts");
  assert.equal(isProjectWalkPath(root, linked), false);
  assert.equal(
    isProjectWalkPath(root, path.join(root, "src", "missing.d.ts")),
    false,
  );
  assert.equal(
    isProjectWalkPath(root, TestUnpluginProject.mainFile(root)),
    true,
  );

  const options = resolveOptions({
    plugins: emitGraphPlugins({
      edges: { "src/main.ts": ["linked/types.d.ts"] },
      inputHashes: {
        "linked/types.d.ts": crypto
          .createHash("sha256")
          .update(compilerText)
          .digest("hex"),
      },
    }),
  });
  const cache = createTtscTransformCache();
  const watched: string[] = [];
  const before = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.ok(before);
  assert.ok(
    watched.includes(linked),
    "watch registration must preserve the lexical linked input",
  );
  const generation = [...cache.values()][0]!;
  const generationState = await generation;
  assert.equal(generationState.result.type, "success");
  const linkedProofHash =
    generationState.result.graph?.inputHashes?.["linked/types.d.ts"];
  assert.ok(
    typeof linkedProofHash === "string" &&
      /^[0-9a-f]{64}$/.test(linkedProofHash),
    "synthetic graph host must publish a content proof for the linked input",
  );
  assert.equal(
    generationState.result.graph?.inputRealpaths?.["linked/types.d.ts"],
    fs.realpathSync.native(linked),
  );

  const unchanged = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(unchanged);
  assert.strictEqual([...cache.values()][0], generation);

  // Notifications are advisory. Close both trackers so the next assertion
  // specifically proves the compiler-time selected-realpath fingerprint.
  generationState.projectMutationTracker?.close();
  generationState.hostInputMutationTracker?.close();
  fs.rmSync(linkedDirectory, { force: true, recursive: true });
  fs.symlinkSync(
    secondTarget,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.notStrictEqual([...cache.values()][0], generation);
}

/**
 * Asserts invalidation covers the in-root ignored-directory class: a
 * `node_modules` declaration lives under the project root yet the walk skips
 * the segment, so only the external validation can see it — the everyday shape
 * of a dependency's hand-edited or reinstalled type declarations.
 */
export async function assertCacheInvalidatesOnNodeModulesDeclarationChange(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const declaration = path.join(
    root,
    "node_modules",
    "fixture-types",
    "types.d.ts",
  );
  fs.mkdirSync(path.dirname(declaration), { recursive: true });
  fs.writeFileSync(declaration, "declare const first: string;\n", "utf8");
  const options = resolveOptions({
    plugins: emitGraphPlugins({
      edges: { "src/main.ts": ["node_modules/fixture-types/types.d.ts"] },
    }),
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

  fs.writeFileSync(declaration, "declare const second: string;\n", "utf8");
  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.notStrictEqual(cacheEntry(cache), generation);
}

/**
 * Asserts the disposed temp-dir tsconfig never joins the external validation
 * universe. A `compilerOptions` overlay compiles through a generated tsconfig
 * that the host's config chain reports and that is deleted right after the
 * compile; hashing it would flip to `missing` on the first revalidation and
 * turn every subsequent transform into a recompile. All compiler scratch must
 * stay outside the project when the operating-system temp root is configured
 * inside it, directly or through a filesystem alias, without masking a real
 * descriptor/config edit. The rule also applies without a generated overlay.
 */
export async function assertExternalValidationIgnoresGeneratedTsconfig(): Promise<void> {
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
