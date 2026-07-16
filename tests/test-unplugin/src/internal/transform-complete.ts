import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { cacheEntry } from "./transform-external";
import { emitGraphPlugins } from "./transform-graph";

/**
 * Scenarios for the dependency-completeness contract (samchon/ttsc#720).
 *
 * A plugin that knows exactly which declarations it consulted can list a
 * transformed file in the envelope's `dependenciesComplete`. The adapter then
 * derives `dependencies[F] ∪ graph.configs` for it instead of the union with
 * the host-owned `reach(graph.edges, F) ∪ graph.globals` bound, which is the
 * only way a consumer can invalidate below language-semantic reachability.
 */

/** The reference graph every scenario reports, so one shape pins one behavior. */
const GRAPH = {
  // main -> unread -> deep proves the whole reach closure drops for a declared
  // file, not only the direct edge. The other.ts edge belongs to the mixed
  // scenario's unmarked file.
  edges: {
    "src/main.ts": ["src/consulted.d.ts", "src/unread.d.ts"],
    "src/unread.d.ts": ["src/deep.d.ts"],
    "src/other.ts": ["src/other-type.d.ts"],
  },
  globals: ["src/ambient.d.ts"],
  configs: ["tsconfig.json"],
};

/** Plugin entry reporting `dependencies` for `src/main.ts`. */
function reportDependencies(dependencies: string[]): unknown {
  return {
    transform: "./plugin.cjs",
    name: "reporter",
    operation: "emit-dependencies",
    dependencies,
  };
}

/** Plugin entry declaring the reported dependency list complete for `complete`. */
function declareComplete(complete: string[]): unknown {
  return {
    transform: "./plugin.cjs",
    name: "completeness",
    operation: "declare-complete",
    complete,
  };
}

/** Absolute path of a fixture graph member, for expectation lists. */
function member(root: string, relative: string): string {
  return path.join(root, ...relative.split("/"));
}

/** Collect the sorted watch inputs the adapter derives for one file. */
async function watchInputs(
  file: string,
  plugins: unknown[],
): Promise<string[]> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const watched: string[] = [];
  const result = await transformTtsc(
    file,
    fs.readFileSync(file, "utf8"),
    resolveOptions({ plugins }),
    undefined,
    undefined,
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.ok(result);
  return [...watched].sort();
}

/**
 * Asserts a file the envelope declares complete is invalidated only by the
 * plugin's own reported inputs plus the universal config chain: the graph's
 * reachability closure from that file and its global-scope files both drop,
 * while a declared input the graph never named still registers.
 */
export async function assertCompleteFileNarrowsToDeclaredAndUniversalInputs(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });

  const watched = await watchInputs(TestUnpluginProject.mainFile(root), [
    reportDependencies(["src/consulted.d.ts", "src/only-declared.d.ts"]),
    ...emitGraphPlugins(GRAPH),
    declareComplete(["src/main.ts"]),
  ]);

  assert.deepEqual(
    watched,
    [
      member(root, "src/consulted.d.ts"),
      member(root, "src/only-declared.d.ts"),
      member(root, "tsconfig.json"),
    ].sort(),
  );
}

/**
 * Asserts the empty-declaration boundary: a file declared complete with no
 * `dependencies` entry at all claims no input beyond itself, so only the
 * universal config chain registers.
 */
export async function assertCompleteFileWithoutDependenciesKeepsOnlyUniversalInputs(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });

  const watched = await watchInputs(TestUnpluginProject.mainFile(root), [
    ...emitGraphPlugins(GRAPH),
    declareComplete(["src/main.ts"]),
  ]);

  assert.deepEqual(watched, [member(root, "tsconfig.json")]);
}

/**
 * Asserts a mixed envelope composes per file: one transform declares
 * `src/main.ts` complete and says nothing about `src/other.ts`, and each file's
 * derivation follows its own status against that single envelope.
 */
export async function assertMixedCompletenessEnvelopeComposesPerFile(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const other = path.join(root, "src", "other.ts");
  fs.writeFileSync(other, "export const other: number = 1;\n", "utf8");
  const options = resolveOptions({
    plugins: [
      reportDependencies(["src/consulted.d.ts"]),
      ...emitGraphPlugins(GRAPH),
      {
        transform: "./plugin.cjs",
        name: "echo",
        operation: "echo-file",
        path: "src/other.ts",
      },
      declareComplete(["src/main.ts"]),
    ],
  });
  // One shared cache, so both files read out of one envelope the way a bundler
  // calls the adapter file by file over a single project transform.
  const cache = createTtscTransformCache();

  const collect = async (file: string): Promise<string[]> => {
    const watched: string[] = [];
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
      { addWatchFile: (input: string) => watched.push(input) },
    );
    assert.ok(result);
    return [...watched].sort();
  };

  assert.deepEqual(
    await collect(TestUnpluginProject.mainFile(root)),
    [member(root, "src/consulted.d.ts"), member(root, "tsconfig.json")].sort(),
  );
  assert.deepEqual(
    await collect(other),
    [
      member(root, "src/other-type.d.ts"),
      member(root, "src/ambient.d.ts"),
      member(root, "tsconfig.json"),
    ].sort(),
  );
}

/**
 * Asserts a file declared both complete and volatile keeps the baseline union.
 * The two declarations contradict (an exact file-input set versus an input no
 * file can represent), so the conservative one wins over the narrower one.
 */
export async function assertVolatileFileIgnoresItsCompletenessDeclaration(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });

  const watched = await watchInputs(TestUnpluginProject.mainFile(root), [
    reportDependencies(["src/consulted.d.ts"]),
    ...emitGraphPlugins(GRAPH),
    declareComplete(["src/main.ts"]),
    {
      transform: "./plugin.cjs",
      name: "volatile",
      operation: "emit-volatile",
      volatile: ["src/main.ts"],
    },
  ]);

  assert.deepEqual(
    watched,
    [
      member(root, "src/consulted.d.ts"),
      member(root, "src/unread.d.ts"),
      member(root, "src/deep.d.ts"),
      member(root, "src/ambient.d.ts"),
      member(root, "tsconfig.json"),
    ].sort(),
  );
}

/**
 * Asserts a completeness declaration does not narrow the project transform
 * cache's own out-of-walk validation: an undeclared external graph member still
 * replaces the cached generation. That layer replays one whole envelope rather
 * than one file, and it is what re-runs the plugin's analysis so a widened
 * declaration can ever be learned; the narrowing lands at the bundler boundary
 * only.
 */
export async function assertCompletenessKeepsExternalCacheValidation(): Promise<void> {
  const { resolveOptions, transformTtsc, createTtscTransformCache } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const shared = TestProject.tmpdir("ttsc-unplugin-external-");
  const external = path.join(shared, "types.d.ts");
  fs.writeFileSync(external, "declare const first: string;\n", "utf8");
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external).split(path.sep).join("/");
  const options = resolveOptions({
    plugins: [
      ...emitGraphPlugins({ edges: { "src/main.ts": [relative] } }),
      declareComplete(["src/main.ts"]),
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
