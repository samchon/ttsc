import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

interface IRealNativeEnvelopeGraph {
  candidates?: Record<string, string[]>;
  configs: string[];
  edges: Record<string, string[]>;
  globals: string[];
  inputHashes?: Record<string, string | null>;
  inputRealpaths?: Record<string, string | null>;
}

interface IRealNativeEnvelopeTransformation {
  graph?: IRealNativeEnvelopeGraph;
  type: string;
  typescript?: Record<string, string>;
}

type RealNativeEnvelopeCache = Map<
  string,
  Promise<{
    projectSnapshotComplete?: boolean;
    result: IRealNativeEnvelopeTransformation;
  }>
>;

interface IRealNativeEnvelopeApi {
  beginTtscTransformBuild(cache: RealNativeEnvelopeCache): void;
  createTtscTransformCache(): RealNativeEnvelopeCache;
  resetTtscTransformCache(cache: RealNativeEnvelopeCache): void;
  resolveOptions(options: { project: string }): unknown;
  transformTtsc(
    file: string,
    source: string,
    options: unknown,
    aliases: undefined,
    cache: RealNativeEnvelopeCache,
  ): Promise<{ code: string } | undefined>;
}

/** A real native-host project whose linked plugin observes Program invocations. */
export interface IRealNativeEnvelopeFixture {
  /** Selected declaration whose compiler proof must survive the JSON boundary. */
  declaration: string;
  /** Missing source that supersedes the package's selected JavaScript entry. */
  missingCandidate: string;
  /** Sibling source modules delivered independently by a bundler. */
  modules: string[];
  /** Project root containing the tsconfig, plugin descriptor, and packages. */
  root: string;
  /** Log outside the project, appended once from each linked ApplyProgram call. */
  runLog: string;
}

interface IRealNativeEnvelopeFixtureOptions {
  /** Rewrite the selected declaration during the first linked-plugin pass. */
  raceDeclarationOnce?: boolean;
}

const SHARED_CONTRIBUTOR_MODULE_ROOT = path.join(
  TestProject.WORKSPACE_ROOT,
  "node_modules",
  ".cache",
  "ttsc-test-unplugin",
  "real-native-envelope-module",
);
const SHARED_CONTRIBUTOR_ROOT = path.join(
  SHARED_CONTRIBUTOR_MODULE_ROOT,
  "compile-probe",
);
let sharedContributorReady = false;

/**
 * Materialize a package-resolution fixture driven by ttsc's utility host.
 *
 * The Go package is deliberately not `main`: ttsc copies it into the ordinary
 * utility host as a linked contributor, whose no-op `ApplyProgram` method runs
 * in the same native invocation that produces `driver.NewTransformGraph`.
 */
export function createRealNativeEnvelopeFixture(
  options: IRealNativeEnvelopeFixtureOptions = {},
): IRealNativeEnvelopeFixture {
  TestUnpluginProject.ensureSharedCacheDir();
  const root = TestProject.tmpdir("ttsc-unplugin-real-envelope-");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-real-envelope-log-"),
    "program-runs.bin",
  );
  const modules = Array.from({ length: 4 }, (_, index) =>
    path.join(root, "src", `mod${index}.ts`),
  );
  const declaration = path.join(
    root,
    "node_modules",
    "typed-dep",
    "dist",
    "index.d.ts",
  );
  const missingCandidate = path.join(
    root,
    "node_modules",
    "linked-pkg",
    "index.ts",
  );

  TestProject.writeFiles(root, {
    "go.mod": "module example.com/ttscunpluginrealenvelope\n\ngo 1.26\n",
    "package.json": JSON.stringify({ private: true, type: "module" }, null, 2),
    "plugin.cjs": [
      "module.exports = (context) => ({",
      '  name: context.plugin.name ?? "real-envelope-compile-probe",',
      `  source: ${JSON.stringify(SHARED_CONTRIBUTOR_ROOT)},`,
      "});",
      "",
    ].join("\n"),
    "compile-probe/probe.go": [
      "package cacheprobe",
      "",
      "import (",
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      "",
      '  "github.com/samchon/ttsc/packages/ttsc/driver"',
      ")",
      "",
      "type plugin struct{}",
      "",
      "func (plugin) ApplyProgram(_ *driver.Program, context driver.PluginContext) error {",
      '  runLog, ok := context.Entry.Config["runLog"].(string)',
      '  if !ok || runLog == "" {',
      '    return fmt.Errorf("real-envelope compile probe requires a runLog string")',
      "  }",
      "  if !filepath.IsAbs(runLog) {",
      "    runLog = filepath.Join(context.Cwd, runLog)",
      "  }",
      "  file, err := os.OpenFile(runLog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)",
      "  if err != nil {",
      "    return err",
      "  }",
      "  info, err := file.Stat()",
      "  if err != nil {",
      "    _ = file.Close()",
      "    return err",
      "  }",
      "  first := info.Size() == 0",
      "  if _, err := file.Write([]byte{1}); err != nil {",
      "    _ = file.Close()",
      "    return err",
      "  }",
      "  if err := file.Close(); err != nil {",
      "    return err",
      "  }",
      "  if first {",
      '    raceFile, _ := context.Entry.Config["raceFile"].(string)',
      '    raceContent, _ := context.Entry.Config["raceContent"].(string)',
      '    if raceFile != "" && raceContent != "" {',
      "      if !filepath.IsAbs(raceFile) {",
      "        raceFile = filepath.Join(context.Cwd, raceFile)",
      "      }",
      "      if err := os.WriteFile(raceFile, []byte(raceContent), 0o644); err != nil {",
      "        return err",
      "      }",
      "    }",
      "  }",
      "  return nil",
      "}",
      "",
      "func init() {",
      "  driver.RegisterPlugin(plugin{})",
      "}",
      "",
    ].join("\n"),
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          allowJs: true,
          module: "Node16",
          moduleResolution: "Node16",
          plugins: [
            {
              name: "real-envelope-compile-probe",
              raceContent:
                options.raceDeclarationOnce === true
                  ? "export interface Shared { label: string; revision?: number; }\n"
                  : undefined,
              raceFile:
                options.raceDeclarationOnce === true ? declaration : undefined,
              runLog,
              transform: "./plugin.cjs",
            },
          ],
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "node_modules/typed-dep/package.json": JSON.stringify(
      {
        main: "dist/index.js",
        name: "typed-dep",
        type: "module",
        types: "dist/index.d.ts",
        version: "0.0.0",
      },
      null,
      2,
    ),
    "node_modules/typed-dep/dist/index.d.ts":
      "export interface Shared { label: string; }\n",
    "node_modules/typed-dep/dist/index.js": 'export const runtime = "typed";\n',
    "node_modules/linked-pkg/package.json": JSON.stringify(
      {
        main: "index.js",
        name: "linked-pkg",
        type: "module",
        version: "0.0.0",
      },
      null,
      2,
    ),
    "node_modules/linked-pkg/index.d.ts":
      "export declare const linked: string;\n",
    "node_modules/linked-pkg/index.js": 'export const linked = "js";\n',
    ...Object.fromEntries(
      modules.map((file, index) => [
        path.relative(root, file),
        [
          'import type { Shared } from "typed-dep";',
          'import { linked } from "linked-pkg";',
          "",
          `export const value${index}: Shared = { label: linked + ${JSON.stringify(String(index))} };`,
          "",
        ].join("\n"),
      ]),
    ),
  });
  if (!sharedContributorReady) {
    fs.mkdirSync(SHARED_CONTRIBUTOR_ROOT, { recursive: true });
    fs.writeFileSync(
      path.join(SHARED_CONTRIBUTOR_MODULE_ROOT, "go.mod"),
      "module example.com/ttscunpluginrealenvelope\n\ngo 1.26\n",
      "utf8",
    );
    fs.copyFileSync(
      path.join(root, "compile-probe", "probe.go"),
      path.join(SHARED_CONTRIBUTOR_ROOT, "probe.go"),
    );
    sharedContributorReady = true;
  }
  return { declaration, missingCandidate, modules, root, runLog };
}

/** Assert persistent and build-scoped core delivery plus Vite wiring. */
export async function assertRealEnvelopeServesSiblingModulesFromOneCompile(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await loadApi();
  await assertCoreLifecycle(api, fixture, false);
  await assertCoreLifecycle(api, fixture, true);
  await assertViteLifecycle(fixture);
}

/** Assert one real compiler-input race stabilizes inside one shared Promise. */
export async function assertRealEnvelopeInputRaceStabilizesWithinSharedGeneration(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture({
    raceDeclarationOnce: true,
  });
  const api = await loadApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  try {
    await Promise.all(
      fixture.modules.map((file) =>
        api.transformTtsc(
          file,
          fs.readFileSync(file, "utf8"),
          options,
          undefined,
          cache,
        ),
      ),
    );
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "concurrent modules must share the failed attempt and its one retry",
    );
    assert.match(fs.readFileSync(fixture.declaration, "utf8"), /revision/);
    assert.equal(cache.size, 1);
    const stableGeneration = [...cache.values()][0]!;
    assert.equal((await stableGeneration).projectSnapshotComplete, true);
    await assertProductionEnvelope(cache, fixture);

    for (const file of fixture.modules) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "every later module must reuse only the stabilized native generation",
    );
    assert.equal([...cache.values()][0], stableGeneration);
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Assert a newly available superseding candidate replaces one generation. */
export async function assertRealEnvelopeCandidateAppearanceReplacesGeneration(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await loadApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  try {
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(programRuns(fixture.runLog), 1);
    await assertProductionEnvelope(cache, fixture);

    fs.writeFileSync(
      fixture.missingCandidate,
      'export const linked = "typescript";\n',
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules[1]!);
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "a superseding package candidate must replace the generation before its next importer is delivered",
    );
    for (const file of fixture.modules.slice(2)) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "sibling deliveries must reuse the generation created after candidate appearance",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Assert a changed selected declaration replaces one persistent generation. */
export async function assertRealEnvelopeDeclarationChangeReplacesGeneration(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await loadApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  try {
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(programRuns(fixture.runLog), 1);
    await assertProductionEnvelope(cache, fixture);

    fs.writeFileSync(
      fixture.declaration,
      "export interface Shared { label: string; revision?: number; }\n",
      "utf8",
    );
    await deliver(api, cache, options, fixture.modules[1]!);
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "a selected declaration edit must replace the generation before its next importer is delivered",
    );
    for (const file of fixture.modules.slice(2)) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "sibling deliveries must reuse the generation created after the declaration edit",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Drive one core cache lifecycle and assert its real envelope before reuse. */
async function assertCoreLifecycle(
  api: IRealNativeEnvelopeApi,
  fixture: IRealNativeEnvelopeFixture,
  buildScoped: boolean,
): Promise<void> {
  const cache = api.createTtscTransformCache();
  if (buildScoped) api.beginTtscTransformBuild(cache);
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  try {
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(programRuns(fixture.runLog), 1);
    await assertProductionEnvelope(cache, fixture);
    for (const file of fixture.modules.slice(1)) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      1,
      `${buildScoped ? "build-scoped" : "persistent"} delivery must serve every sibling module from one production host invocation`,
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Drive the public Vite adapter over the same production-host fixture. */
async function assertViteLifecycle(
  fixture: IRealNativeEnvelopeFixture,
): Promise<void> {
  const { createServer } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN(
    "vite",
  ) as {
    createServer(config: object): Promise<any>;
  };
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const viteRoot = fs.realpathSync.native(fixture.root);
  resetRunLog(fixture.runLog);
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    root: viteRoot,
    server: { hmr: false, middlewareMode: true, watch: null },
  });
  try {
    const graph =
      server.environments?.client?.moduleGraph ?? server.moduleGraph;
    const nodes: any[] = [];
    for (const file of fixture.modules) {
      const url = `/${path.relative(fixture.root, file).split(path.sep).join("/")}`;
      const result = await server.transformRequest(url);
      assert.ok(result?.code, `Vite must transform ${url}`);
      const node = await graph.getModuleByUrl(url);
      assert.ok(node, `Vite's module graph must contain ${url}`);
      assert.ok(
        node.transformResult,
        `Vite must cache the first transform result for ${url}`,
      );
      nodes.push(node);
    }
    assert.equal(
      programRuns(fixture.runLog),
      1,
      "the Vite watcherless lifecycle must serve every sibling module from one production host invocation",
    );

    // Vite can transpile TypeScript even if the ttsc adapter bypasses a module,
    // so returned code alone does not prove all four requests crossed our
    // transform hook. The adapter registers this real missing candidate for
    // every importer it serves; its private poll invalidates exactly those
    // module nodes when the candidate appears, even with Vite's watcher off.
    fs.writeFileSync(
      fixture.missingCandidate,
      'export const linked = "typescript";\n',
      "utf8",
    );
    await waitFor(
      () =>
        nodes.every(
          (node) =>
            node.transformResult === null || node.transformResult === undefined,
        ),
      "every sibling module to be invalidated by the adapter's candidate registry",
    );
    assert.equal(
      programRuns(fixture.runLog),
      1,
      "candidate notification must invalidate sibling deliveries without compiling until Vite requests them again",
    );
  } finally {
    await server.close();
  }
}

/** Load the compiled public unplugin API exercised by consumers. */
async function loadApi(): Promise<IRealNativeEnvelopeApi> {
  return (await TestUnpluginRuntime.loadUnpluginApi()) as IRealNativeEnvelopeApi;
}

/** Deliver one source file through the public transform API. */
async function deliver(
  api: IRealNativeEnvelopeApi,
  cache: RealNativeEnvelopeCache,
  options: unknown,
  file: string,
): Promise<void> {
  await api.transformTtsc(
    file,
    fs.readFileSync(file, "utf8"),
    options,
    undefined,
    cache,
  );
}

/** Poll an asynchronous adapter consequence until it is observed. */
async function waitFor(
  predicate: () => boolean,
  what: string,
  timeout = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`timed out waiting for ${what}`);
}

/** Inspect the actual generation admitted by @ttsc/unplugin. */
async function assertProductionEnvelope(
  cache: RealNativeEnvelopeCache,
  fixture: IRealNativeEnvelopeFixture,
): Promise<void> {
  assert.equal(cache.size, 1, "one project must own one cached generation");
  const generation = [...cache.values()][0];
  assert.ok(generation, "the first delivery must admit a generation");
  const { result } = await generation;
  assert.equal(result.type, "success");
  assert.ok(result.typescript, "the native host must return TypeScript output");
  for (const file of fixture.modules) {
    const key = findGraphSpelling(
      fixture.root,
      Object.keys(result.typescript),
      file,
    );
    assert.ok(
      key,
      `the native envelope must contain the sibling output ${graphKey(fixture.root, file)}`,
    );
  }

  const graph = result.graph;
  assert.ok(
    graph,
    "the production native host must return its reference graph",
  );
  const candidates = Object.values(graph.candidates ?? {}).flat();
  assert.ok(candidates.length > 0, "the real graph must contain candidates");
  const realized = new Set([
    ...Object.keys(graph.edges),
    ...Object.values(graph.edges).flat(),
    ...graph.globals,
    ...graph.configs,
    ...Object.keys(graph.candidates ?? {}),
  ]);
  const candidateOnly = candidates.filter(
    (candidate) => !realized.has(candidate),
  );
  assert.ok(
    candidateOnly.length > 0,
    "the fixture must produce a candidate that is not a realized graph member",
  );
  const unproven = candidateOnly.find(
    (candidate) =>
      !Object.prototype.hasOwnProperty.call(
        graph.inputHashes ?? {},
        candidate,
      ) &&
      !Object.prototype.hasOwnProperty.call(
        graph.inputRealpaths ?? {},
        candidate,
      ),
  );
  assert.ok(
    unproven,
    "the fixture must produce a candidate-only path with no compiler hash or realpath proof",
  );

  const knownCandidate = findGraphSpelling(
    fixture.root,
    candidates,
    fixture.missingCandidate,
  );
  assert.ok(
    knownCandidate,
    `the real graph must retain the superseding package candidate ${graphKey(fixture.root, fixture.missingCandidate)}`,
  );
  assert.equal(fs.existsSync(fixture.missingCandidate), false);

  const declaration = findGraphSpelling(
    fixture.root,
    Object.values(graph.edges).flat(),
    fixture.declaration,
  );
  assert.ok(
    declaration,
    `the selected declaration must be a realized edge: ${graphKey(fixture.root, fixture.declaration)}`,
  );
  assert.match(
    graph.inputHashes?.[declaration] ?? "",
    /^[0-9a-f]{64}$/,
    "the selected declaration must carry a compiler content proof",
  );
  assert.equal(
    typeof graph.inputRealpaths?.[declaration],
    "string",
    "the selected declaration must carry a compiler realpath proof",
  );
}

/** Find the producer's spelling for one semantic filesystem path. */
function findGraphSpelling(
  root: string,
  spellings: readonly string[],
  file: string,
): string | undefined {
  const expected = comparablePath(file);
  return spellings.find(
    (spelling) =>
      comparablePath(graphAbsolutePath(root, spelling)) === expected,
  );
}

/** Resolve one relative-or-absolute graph key to a native absolute path. */
function graphAbsolutePath(root: string, spelling: string): string {
  const native = spelling.split("/").join(path.sep);
  return path.resolve(
    path.isAbsolute(native) ? native : path.join(root, native),
  );
}

/** Apply the host filesystem's path-case contract for semantic comparisons. */
function comparablePath(file: string): string {
  const resolved = physicalPath(file);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Resolve aliases even when the final candidate does not exist yet. */
function physicalPath(file: string): string {
  let existing = path.resolve(file);
  const missing: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  try {
    existing = fs.realpathSync.native(existing);
  } catch {
    // The lexical root is still the only usable identity on an unreadable path.
  }
  return path.resolve(existing, ...missing);
}

/** Convert an absolute fixture path into the native envelope's key vocabulary. */
function graphKey(root: string, file: string): string {
  const relative = path.relative(root, file);
  const selected =
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
      ? relative
      : path.resolve(file);
  return selected.split(path.sep).join("/");
}

/** Reset the observer without introducing a file under the project root. */
function resetRunLog(runLog: string): void {
  fs.writeFileSync(runLog, Buffer.alloc(0));
}

/** Count linked ApplyProgram calls from the one-byte append protocol. */
function programRuns(runLog: string): number {
  return fs.existsSync(runLog) ? fs.statSync(runLog).size : 0;
}
