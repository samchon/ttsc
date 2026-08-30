import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
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

/** Exact compiler/descriptor inputs that affect every transformed module. */
function universalHostInputs(root: string): string[] {
  return ["package.json", "plugin.cjs", "tsconfig.json"].map((file) =>
    path.join(root, file),
  );
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
 * Asserts the loader applies the shared transform-target filter, not a subset
 * of it (samchon/ttsc#1305).
 *
 * The loader used to re-implement two of `isTransformTarget`'s four conditions
 * while its docstring, the README and the website all claimed parity, so a rule
 * glob wider than `*.ts`/`*.tsx` — the natural thing to write for a project
 * with mixed sources, and the reason a loader needs a filter at all — routed
 * JavaScript and virtual ids into the whole-project transform every other
 * adapter excludes. A project without `allowJs` has no program entry for such a
 * file, so the delivery reached `selectTransformedSource` with nothing to
 * return, and under the per-delivery eviction each one cost a whole-project
 * compile first. That condition no longer fails a build (samchon/ttsc#1308),
 * but routing a file into a whole-project transform that can never produce
 * output for it is still work the filter exists to avoid.
 *
 * The four JavaScript rows are the regression guard: before the fix each of
 * them reached `selectTransformedSource` without output. The virtual row is
 * defence in depth rather than a second regression, because `transformTtsc`
 * short-circuits a NUL id itself, so the old loader also returned that source
 * untouched; what it pins is that the loader stops depending on a guard living
 * inside the transform. The declaration and `node_modules` rows both filters
 * already agreed on stay pinned by
 * {@link assertTurbopackLoaderPassesThroughFilteredPaths}.
 */
async function assertTurbopackLoaderPassesThroughNonSourceIds(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const script = 'export const value = goUpper("plugin");\n';
  for (const extension of ["js", "mjs", "cjs", "jsx"]) {
    const out = await runTurbopackLoader({
      resourcePath: path.join(root, "src", `sibling.${extension}`),
      source: script,
    });
    assert.equal(
      out,
      script,
      `a .${extension} module must pass through untouched, as every other adapter leaves it`,
    );
  }

  const virtual = "export const virtual = 1;\n";
  const virtualOut = await runTurbopackLoader({
    resourcePath: "\0virtual:module.ts",
    source: virtual,
  });
  assert.equal(
    virtualOut,
    virtual,
    "a virtual id must be filtered where every other adapter filters it",
  );
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
    ...universalHostInputs(root),
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
  const expected = [
    path.join(root, "src", "types.d.ts"),
    ...universalHostInputs(root),
  ];

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
 * Asserts the negative twin: a transform whose plugin reports no per-file
 * `dependencies` registers only the compiler/descriptor inputs that affect
 * every module. A loader that fabricated other paths would pollute Turbopack's
 * invalidation graph, while omitting these universal inputs would serve stale
 * transforms after a descriptor or config edit.
 */
async function assertTurbopackLoaderRegistersNoDependenciesWithoutReport(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const { content, dependencies } = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  });
  TestUnpluginProject.assertTransformedToPlugin(content);
  assert.deepEqual(dependencies, universalHostInputs(root));
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

/**
 * Asserts a module the compiled program does not contain passes through the
 * loader instead of failing the Turbopack build.
 *
 * Samchon/ttsc#1308 moved that decision into the shared core so every adapter
 * answers it once, and asked for it to be proven per adapter rather than for
 * the core alone; samchon/ttsc#1317 records that it never was. The core case
 * pins the report and the once-per-pass rule, and this pins the outcome at the
 * boundary that actually reaches a bundler.
 *
 * The discriminator is the absence of a throw. This file is a genuine transform
 * target — a real `.ts` under the project root, outside `node_modules`, not a
 * declaration — so no filter turns it away; it is simply absent from the
 * program, because the fixture's tsconfig includes `src` alone. Before #1308
 * the adapter threw here and Turbopack turned that into a build failure.
 *
 * Returning the source unchanged is on its own a weak assertion, because it is
 * also what the loader does for a path its filter rejects — so a case resting
 * on it alone would keep passing if the module stopped reaching the transform
 * at all, and would then prove nothing about the program. The report is what
 * distinguishes them: only a delivery that reached the compile and found no
 * output for this file can emit it, so asserting it pins that the pass-through
 * happened for the stated reason. It is also half the contract, since passing
 * through must not be silent.
 */
async function assertTurbopackLoaderPassesThroughAnOutOfProgramModule(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const stray = path.join(root, "scripts", "tool.ts");
  fs.mkdirSync(path.dirname(stray), { recursive: true });
  const source = "export const tool: string = 'STRAY';\n";
  fs.writeFileSync(stray, source, "utf8");

  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = ((chunk: unknown) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  let content: string;
  try {
    content = await runTurbopackLoader({ resourcePath: stray, source });
  } finally {
    process.stderr.write = original;
  }

  assert.equal(
    content,
    source,
    "a module outside the program must pass through the loader unchanged",
  );
  assert.ok(
    captured.includes(stray) &&
      captured.includes(path.join(root, "tsconfig.json")),
    `the loader must have reached the program and reported the module (got ${JSON.stringify(captured)})`,
  );
}

export {
  assertTurbopackLoaderForwardsRuleOptions,
  assertTurbopackLoaderMarksVolatileModulesUncacheable,
  assertTurbopackLoaderPassesThroughAnOutOfProgramModule,
  assertTurbopackLoaderPassesThroughFilteredPaths,
  assertTurbopackLoaderPassesThroughNonSourceIds,
  assertTurbopackLoaderRegistersDependenciesOnCacheHit,
  assertTurbopackLoaderRegistersNoDependenciesWithoutReport,
  assertTurbopackLoaderRegistersPluginDependencies,
  assertTurbopackLoaderTransformsSource,
  assertTurbopackLoaderTransformsWithoutAddDependency,
};
