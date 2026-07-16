import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Build the plugin descriptor list that routes the fixture plugin through the
 * `emit-graph` operation with the given graph section. Plugin options live at
 * the entry top level: the protocol forwards the whole
 * `compilerOptions.plugins[i]` entry as the plugin's config object.
 */
function emitGraphPlugins(graph: {
  configs?: string[];
  echoTsconfig?: boolean;
  edges?: Record<string, string[]>;
  globals?: string[];
}): unknown[] {
  return [
    {
      transform: "./plugin.cjs",
      name: "fixture",
      operation: "emit-graph",
      ...graph,
    },
  ];
}

/**
 * Asserts the transform registers the host-owned reference graph's contribution
 * for the transformed file: the reachability closure of `edges` from the file
 * (transitively, through a chain the bundler cannot see), plus `globals` and
 * `configs` — absolutized against the project root, deduplicated, with the
 * module itself excluded even when a cycle or the globals list points back at
 * it, and with unreachable edges ignored.
 */
async function assertTransformRegistersGraphReachGlobalsAndConfigs(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: emitGraphPlugins({
        edges: {
          "src/main.ts": ["src/a.d.ts"],
          // a -> b proves transitive reach; a -> main proves the module
          // itself stays excluded even through a cycle.
          "src/a.d.ts": ["src/b.d.ts", "src/main.ts"],
          // Unreachable from main.ts; must not be registered.
          "src/other.ts": ["src/unrelated.d.ts"],
        },
        globals: ["src/ambient.d.ts", "src/main.ts"],
        configs: ["tsconfig.json"],
      }),
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
  assert.deepEqual(
    [...watched].sort(),
    [
      path.join(root, "src", "a.d.ts"),
      path.join(root, "src", "b.d.ts"),
      path.join(root, "src", "ambient.d.ts"),
      path.join(root, "tsconfig.json"),
    ].sort(),
  );
}

/**
 * Asserts graph-derived inputs and plugin-reported dependencies register as a
 * deduplicated union: an input reported through both channels arrives once, and
 * each channel contributes its exclusive entries.
 */
async function assertGraphAndDependenciesRegisterAsUnion(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "dependencies",
          operation: "emit-dependencies",
          dependencies: ["src/shared.d.ts", "src/only-dependency.d.ts"],
        },
        {
          transform: "./plugin.cjs",
          name: "graph",
          operation: "emit-graph",
          edges: { "src/main.ts": ["src/shared.d.ts", "src/only-graph.d.ts"] },
        },
      ],
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.deepEqual(
    [...watched].sort(),
    [
      path.join(root, "src", "shared.d.ts"),
      path.join(root, "src", "only-dependency.d.ts"),
      path.join(root, "src", "only-graph.d.ts"),
    ].sort(),
  );
}

/**
 * Asserts the generated temp-dir tsconfig never registers as a watch input.
 *
 * A `compilerOptions` overlay makes the adapter compile through a generated
 * tsconfig in the system temp directory; the host's graph lists that file in
 * its config chain (the fixture echoes the `--tsconfig` flag), but the file is
 * disposed right after the compile, so registering it would invalidate every
 * persistent-cache snapshot on the next build.
 */
async function assertGeneratedTsconfigIsNotRegistered(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: { removeComments: true },
      plugins: emitGraphPlugins({
        echoTsconfig: true,
        edges: { "src/main.ts": ["src/types.d.ts"] },
      }),
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  // The type edge still registers; the echoed temp-dir tsconfig must not.
  assert.deepEqual(watched, [path.join(root, "src", "types.d.ts")]);
}

export {
  assertGeneratedTsconfigIsNotRegistered,
  assertGraphAndDependenciesRegisterAsUnion,
  assertTransformRegistersGraphReachGlobalsAndConfigs,
  emitGraphPlugins,
};
