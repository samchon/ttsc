import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Invoke the built turbopack loader entrypoint with a minimal fake of the
 * webpack loader context Turbopack provides (`async()`, `resourcePath`,
 * `getOptions()`), returning the content the loader hands to the callback.
 */
async function runTurbopackLoader(props: {
  resourcePath: string;
  source: string;
  options?: unknown;
}): Promise<string> {
  return (await runTurbopackLoaderWithContext(props)).content;
}

/**
 * Invoke the built turbopack loader and return both the transformed content and
 * the files it registered through the webpack loader context's
 * `addDependency(file)` — the channel that feeds Turbopack's `fileDependencies`
 * invalidation set. Setting `omitAddDependency` models a minimal/older loader
 * context that does not expose the method at all, proving the loader stays
 * optional about it.
 */
async function runTurbopackLoaderWithContext(props: {
  resourcePath: string;
  source: string;
  options?: unknown;
  omitAddDependency?: boolean;
}): Promise<{
  cacheableCalls: boolean[];
  content: string;
  dependencies: string[];
}> {
  const loader = await TestUnpluginRuntime.loadUnpluginAdapter("turbopack");
  const cacheableCalls: boolean[] = [];
  const dependencies: string[] = [];
  return new Promise<{
    cacheableCalls: boolean[];
    content: string;
    dependencies: string[];
  }>((resolve, reject) => {
    const context: Record<string, unknown> = {
      resourcePath: props.resourcePath,
      getOptions: () => props.options,
      cacheable: function (this: unknown, flag: boolean): void {
        // Capture `this` binding: the loader must call cacheable bound to the
        // webpack loader context, not the transform hooks object.
        assert.equal(this, context, "cacheable lost its context binding");
        cacheableCalls.push(flag);
      },
      async:
        () =>
        (error?: unknown, content?: string): void => {
          if (error !== undefined && error !== null) {
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
          }
          resolve({ cacheableCalls, content: content ?? "", dependencies });
        },
    };
    if (props.omitAddDependency !== true) {
      context.addDependency = function (this: unknown, file: string): void {
        // Capture `this` binding: the loader must call addDependency bound to
        // the webpack loader context, not the transform hooks object.
        assert.equal(this, context, "addDependency lost its context binding");
        dependencies.push(file);
      };
    }
    loader.call(context, props.source);
  });
}

/**
 * Plugin descriptor routing the fixture through the `emit-dependencies`
 * operation with the given dependency entries. Options ride the plugin entry's
 * top level; the protocol forwards the whole entry as the plugin's config.
 */
function emitDependenciesPlugins(dependencies: string[]): unknown[] {
  return [
    {
      transform: "./plugin.cjs",
      name: "fixture",
      operation: "emit-dependencies",
      dependencies,
    },
  ];
}

/**
 * Asserts the loader transforms TypeScript source through the webpack loader
 * contract using the project's own tsconfig-declared plugins — the exact way
 * Turbopack invokes loaders registered in `turbopack.rules`.
 */
async function assertTurbopackLoaderTransformsSource(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const output = await runTurbopackLoader({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  });
  TestUnpluginProject.assertTransformedToPlugin(output);
}

/**
 * Asserts the rule's `options` object reaches the transform: a plugin list
 * passed through loader options must override the tsconfig-declared plugins,
 * here proven by the fixture's `go-prefix` operation reshaping the output.
 */
async function assertTurbopackLoaderForwardsRuleOptions(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const output = await runTurbopackLoader({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "A:" }],
    },
  });
  assert.match(output, /"A:plugin"/);
}

/**
 * Asserts the loader's own filter: declaration files and `node_modules` paths
 * pass through byte-for-byte. A broad `*.ts` rule glob routes everything with
 * the extension through the loader, so the loader must mirror the unplugin
 * adapters' `transformInclude` guard itself.
 */
async function assertTurbopackLoaderPassesThroughFilteredPaths(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const declaration = "declare const ambient: number;\n";
  const declarationOut = await runTurbopackLoader({
    resourcePath: path.join(root, "src", "ambient.d.ts"),
    source: declaration,
  });
  assert.equal(declarationOut, declaration);

  const vendored = 'export const value: string = goUpper("plugin");\n';
  const vendoredOut = await runTurbopackLoader({
    resourcePath: path.join(root, "node_modules", "pkg", "main.ts"),
    source: vendored,
  });
  assert.equal(vendoredOut, vendored);
}

/**
 * Asserts the loader registers plugin-reported dependencies through
 * `addDependency`, normalized exactly as the other adapters normalize their
 * watch files: project-relative entries absolutized against the project root,
 * absolute entries kept, duplicates collapsed, and the transformed module
 * itself excluded.
 *
 * The standalone Turbopack loader used to call the shared transform without a
 * hooks argument, so the reported dependency list was silently dropped and
 * type-only inputs never entered Turbopack's invalidation graph. The dependency
 * list mixes a relative entry, an absolute entry, a duplicate, and the module
 * itself to pin the normalization.
 */
async function assertTurbopackLoaderRegistersPluginDependencies(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const absolute = path.join(root, "types", "model.d.ts");
  const { content, dependencies } = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: emitDependenciesPlugins([
        "src/types.d.ts",
        absolute,
        "src/types.d.ts",
        "src/main.ts",
      ]),
    },
  });
  TestUnpluginProject.assertTransformedToPlugin(content);
  assert.deepEqual(dependencies, [
    path.join(root, "src", "types.d.ts"),
    absolute,
  ]);
}

/**
 * Asserts a cache-served transform still registers the dependency list.
 *
 * The Turbopack loader shares one transform cache for the worker lifetime
 * across requests, but Turbopack rebuilds its `fileDependencies` set per loader
 * invocation. A cache hit that skipped re-registration would drop invalidation
 * for the second and later requests, so the loader must replay the dependencies
 * on every call, not only the fresh compile.
 */
async function assertTurbopackLoaderRegistersDependenciesOnCacheHit(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = {
    plugins: emitDependenciesPlugins(["src/types.d.ts"]),
  };
  const expected = [path.join(root, "src", "types.d.ts")];

  const first = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options,
  });
  TestUnpluginProject.assertTransformedToPlugin(first.content);
  assert.deepEqual(first.dependencies, expected);

  const second = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options,
  });
  TestUnpluginProject.assertTransformedToPlugin(second.content);
  assert.deepEqual(second.dependencies, expected);
}

/**
 * Asserts the negative twin: a transform whose plugin reports no `dependencies`
 * envelope field registers nothing, while still transforming the module. A
 * loader that fabricated dependencies would pollute Turbopack's invalidation
 * graph.
 */
async function assertTurbopackLoaderRegistersNoDependenciesWithoutReport(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const { content, dependencies } = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  });
  TestUnpluginProject.assertTransformedToPlugin(content);
  assert.deepEqual(dependencies, []);
}

/**
 * Asserts a loader context that does not expose `addDependency` (a minimal stub
 * or a Turbopack build predating the method) still transforms without throwing.
 * The dependency channel is a best-effort enhancement, not a hard requirement
 * of the loader contract.
 */
async function assertTurbopackLoaderTransformsWithoutAddDependency(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const { content, dependencies } = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: emitDependenciesPlugins(["src/types.d.ts"]),
    },
    omitAddDependency: true,
  });
  TestUnpluginProject.assertTransformedToPlugin(content);
  assert.deepEqual(dependencies, []);
}

/**
 * Asserts the loader marks a plugin-declared volatile module uncacheable
 * through the webpack loader contract's `cacheable(false)`, and its negative
 * twin: an ordinary transform never toggles cacheability.
 *
 * A volatile module's output depends on non-file inputs, which no
 * `fileDependencies` snapshot can represent; `cacheable(false)` is the only
 * loader-level channel that excludes it from caching.
 */
async function assertTurbopackLoaderMarksVolatileModulesUncacheable(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const volatileRun = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "emit-volatile",
          volatile: ["src/main.ts"],
        },
      ],
    },
  });
  assert.match(volatileRun.content, /"PLUGIN:\d+"/);
  assert.deepEqual(volatileRun.cacheableCalls, [false]);

  const hermeticRun = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "go-uppercase",
        },
      ],
    },
  });
  TestUnpluginProject.assertTransformedToPlugin(hermeticRun.content);
  assert.deepEqual(hermeticRun.cacheableCalls, []);
}

export {
  assertTurbopackLoaderForwardsRuleOptions,
  assertTurbopackLoaderMarksVolatileModulesUncacheable,
  assertTurbopackLoaderPassesThroughFilteredPaths,
  assertTurbopackLoaderRegistersDependenciesOnCacheHit,
  assertTurbopackLoaderRegistersNoDependenciesWithoutReport,
  assertTurbopackLoaderRegistersPluginDependencies,
  assertTurbopackLoaderTransformsSource,
  assertTurbopackLoaderTransformsWithoutAddDependency,
};
