import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { emitGraphPlugins } from "./transform-graph";

/**
 * Scenarios for the out-of-walk cache validation
 * (`TtscCachedProjectTransform.externalInputHashes`, samchon/ttsc#721).
 *
 * The project-walk snapshot cannot see inputs outside the project root or under
 * ignored directories, yet the reference graph and the plugin-reported
 * dependencies prove they feed the transform. Hosts without a per-build cache
 * boundary (Metro workers, the Turbopack loader, Bun) keep one cache for the
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
 * turn every subsequent transform into a recompile.
 */
export async function assertExternalValidationIgnoresGeneratedTsconfig(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = resolveOptions({
    compilerOptions: { removeComments: true },
    plugins: emitGraphPlugins({
      echoTsconfig: true,
      edges: { "src/main.ts": ["src/types.d.ts"] },
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
