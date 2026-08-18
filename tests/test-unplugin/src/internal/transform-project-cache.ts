// Loading @ttsc/testing evaluates TestUnpluginProject, which seeds
// TTSC_TSGO_BINARY for in-process transformTtsc calls.
import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Options for the synthetic multi-file project used by the cache scenarios.
 *
 * `emitExternalKey` makes the fixture transform emit one output entry keyed
 * outside the project's directory walk (a `node_modules/**` path), reproducing
 * what the native host does for program dependencies (`node_modules`
 * declarations, sibling-package sources). `graphFanout` makes the fixture stamp
 * a reference-graph envelope where every module edges to every sibling plus
 * that many planted `node_modules/dep{j}/index.d.ts` declarations — the shape
 * typia >= 13.1.19 produces.
 *
 * `graphGlobals` plants that many `node_modules/global{j}/index.d.ts` files and
 * stamps them into the envelope's `graph.globals`, the shape a real program
 * produces for every global-scope declaration package (`@types/node` first of
 * all). Unlike edges, globals belong to every delivered module at once, so they
 * are the input class a per-delivery revalidation multiplies by module count.
 * It requires a positive `graphFanout`: the fixture builds the whole `graph`
 * section only for a graph-bearing envelope, so globals alone would produce no
 * graph at all and silently exercise complete-snapshot validation instead.
 */
interface ICacheProjectOptions {
  /**
   * Add a second lexical spelling of one global — a file symlink beside it —
   * and stamp both into `graph.globals`, the alias first.
   *
   * The two share one physical identity but not their metadata, which is what
   * separates a per-spelling proof from a per-identity one. Order matters:
   * `deriveWatchInputs` deduplicates graph inputs by identity, so only the
   * first spelling is validated per delivery, while the out-of-walk snapshot
   * keeps both and records the _last_ one under a shared identity key. Stamping
   * the alias first therefore makes a per-identity manifest answer the wrong
   * spelling and re-read the file on every delivery, which is the cost the
   * per-spelling proof exists to avoid.
   *
   * POSIX only: creating a file symlink on Windows needs elevation, so the
   * option is dropped there and the case keeps its other assertions on every
   * platform.
   */
  aliasedGlobal?: boolean;
  emitExternalKey?: boolean;
  externalSnapshotAbaRace?: boolean;
  fileCount?: number;
  graphFanout?: number;
  graphGlobals?: number;
  independentGraphLeaf?: string;
  partitionGraph?: boolean;
  snapshotAbaRace?: boolean;
  unrelatedDirectoryCount?: number;
}

// Build the Go fixture once per process; transformTtsc shells out to it.
process.env.TTSC_CACHE_DIR ??= TestProject.tmpdir("ttsc-unplugin-cache-");

/**
 * Drive a real transform over every module of a multi-file project sharing one
 * persistent cache, then return how many whole-project transforms the fixture
 * plugin actually ran plus the per-module results.
 *
 * The fixture plugin appends one byte to a run-log file on every invocation, so
 * the caller can assert that the cache collapsed N modules into a single
 * compile.
 */
async function runProjectBuild(options: ICacheProjectOptions): Promise<{
  pluginRuns: number;
  outputs: string[];
}> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject(options);
  const cache = createTtscTransformCache();
  const outputs: string[] = [];
  for (const file of projectModules(project.root)) {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      resolveOptions(),
      undefined,
      cache,
    );
    assert.ok(result, `expected transformed output for ${file}`);
    outputs.push(result.code);
  }
  const pluginRuns = fs.existsSync(project.runLog)
    ? fs.readFileSync(project.runLog, "utf8").length
    : 0;
  return { pluginRuns, outputs };
}

/** Assert concurrent caches neither share counters nor propagate one fault. */
async function assertFilesystemOperationsAreCacheLocal(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const firstProject = createCacheProject({ fileCount: 1 });
  const secondProject = createCacheProject({ fileCount: 1 });
  const firstFile = projectModules(firstProject.root)[0]!;
  const secondFile = projectModules(secondProject.root)[0]!;
  const options = resolveOptions();
  const reads = { first: 0, second: 0 };
  const firstOperationLocations: string[] = [];
  let firstFaults = 0;
  const isWithin = (root: string, location: string): boolean => {
    const relative = path.relative(root, location);
    return (
      relative === "" ||
      (relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative))
    );
  };
  const first = createTtscTransformCache({
    readFile: (location: string) => {
      reads.first += 1;
      return fs.readFileSync(location);
    },
    readdir: (location: string) => {
      if (fs.existsSync(firstProject.runLog)) {
        const absolute = path.resolve(location);
        firstOperationLocations.push(absolute);
        if (isWithin(firstProject.root, absolute)) {
          firstFaults += 1;
          const error = new Error(
            "first cache injected readdir failure",
          ) as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const second = createTtscTransformCache({
    readFile: (location: string) => {
      reads.second += 1;
      return fs.readFileSync(location);
    },
    readdir: (location: string) =>
      fs.readdirSync(location, { withFileTypes: true }),
  });

  const [firstResult, secondResult] = await Promise.all([
    transformTtsc(
      firstFile,
      fs.readFileSync(firstFile, "utf8"),
      options,
      undefined,
      first,
    ),
    transformTtsc(
      secondFile,
      fs.readFileSync(secondFile, "utf8"),
      options,
      undefined,
      second,
    ),
  ]);
  assert.ok(firstResult);
  assert.ok(secondResult);
  assert.ok(reads.first > 0);
  assert.ok(reads.second > 0);
  assert.ok(firstFaults > 0);
  assert.ok(
    firstOperationLocations.every(
      (location) => !isWithin(secondProject.root, location),
    ),
    "the first cache's injected failure must never observe the second project",
  );
}

/**
 * Asserts the shared project cache compiles a multi-file project once and
 * serves every other module from cache — the happy-path baseline.
 *
 * Every compiler output key sits inside the project walk, so this holds on both
 * the old and fixed code; the out-of-walk regression is pinned separately by
 * {@link assertCacheHitsDespiteOutOfWalkOutputKey}. A single `transformTtsc`
 * over N modules sharing one cache must spawn the native transform once; the
 * remaining modules read their output from the cached whole-project result.
 */
async function assertCacheTransformsMultiFileProjectOnce(): Promise<void> {
  const { pluginRuns, outputs } = await runProjectBuild({ fileCount: 6 });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
  for (const code of outputs) {
    assert.match(code, /PROBED/);
  }
}

/**
 * Asserts samchon/ttsc#252: the cache still hits when the transform output
 * includes an entry keyed outside the project's directory walk.
 *
 * The stored hash snapshot and the per-module validation snapshot must draw
 * their keys from the same project walk. The regression overlaid the compiler's
 * output keys — which include `node_modules` declarations the validator never
 * re-hashes — on only the store side, so the snapshots never matched, the cache
 * missed on every module, and the whole project was re-transformed once per
 * file. Any real project importing a typed dependency triggers this.
 *
 * 1. Build a multi-file project whose fixture transform emits one
 *    `node_modules/**` output key.
 * 2. Run a transform over every module sharing one persistent cache.
 * 3. Assert the plugin ran exactly once (cache hit), not once per module.
 */
async function assertCacheHitsDespiteOutOfWalkOutputKey(): Promise<void> {
  const { pluginRuns, outputs } = await runProjectBuild({
    emitExternalKey: true,
    fileCount: 6,
  });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
  for (const code of outputs) {
    assert.match(code, /PROBED/);
  }
}

/**
 * Prime a shared cache with one real successful transform of the default
 * fixture and return the cache API, the single cache key, the resolved good
 * generation value, and the arguments needed to retry the same module.
 *
 * The eviction scenarios below reuse this to plant a failed generation under
 * the exact key `transformTtsc` computes, without depending on the private
 * cache-key encoding.
 */
async function primeSuccessfulTransform(): Promise<{
  api: {
    createTtscTransformCache: () => Map<string, Promise<unknown>>;
    resolveOptions: (raw?: unknown) => unknown;
    transformTtsc: (
      ...args: unknown[]
    ) => Promise<{ code: string } | undefined>;
  };
  cache: Map<string, Promise<unknown>>;
  key: string;
  good: unknown;
  file: string;
  source: string;
  options: unknown;
}> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const cache = api.createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const options = api.resolveOptions();
  const first = await api.transformTtsc(
    file,
    source,
    options,
    undefined,
    cache,
  );
  assert.ok(first, "expected the primed transform to produce output");
  TestUnpluginProject.assertTransformedToPlugin(first.code);
  assert.equal(cache.size, 1);
  const key = [...cache.keys()][0]!;
  const good = await cache.get(key);
  return { api, cache, key, good, file, source, options };
}

/**
 * Asserts a rejected in-flight transform generation is surfaced to the caller
 * and evicted, so a corrected environment recovers.
 *
 * The cache stores the transform Promise before it settles so concurrent
 * callers share one compile. If a rejected generation stayed cached, a
 * transient toolchain/host failure would become permanent for a long-lived
 * Metro or Turbopack worker: every later request for the unchanged module would
 * replay the old rejection instead of retrying. Replacing the primed success
 * with a rejected Promise reproduces the `await transformed` branch exactly.
 */
async function assertRejectedTransformIsEvictedAndRecovers(): Promise<void> {
  const { api, cache, key, file, source, options } =
    await primeSuccessfulTransform();

  const rejected = Promise.reject(new Error("transient host failure"));
  rejected.catch(() => undefined); // suppress the unhandled-rejection warning
  cache.set(key, rejected);

  await assert.rejects(
    () => api.transformTtsc(file, source, options, undefined, cache),
    /transient host failure/,
  );
  assert.equal(cache.size, 0, "rejected generation must not stay cached");

  const recovered = await api.transformTtsc(
    file,
    source,
    options,
    undefined,
    cache,
  );
  assert.ok(recovered, "corrected retry must re-run the transform");
  TestUnpluginProject.assertTransformedToPlugin(recovered.code);
  assert.equal(cache.size, 1);
}

/**
 * Asserts a resolved host-`"exception"` envelope is surfaced and evicted.
 *
 * A generation can also fail by resolving to an `ITtscCompilerTransformation`
 * whose `type` is `"exception"`, which makes `selectTransformedSource` throw.
 * That is a failed generation too and must not be retained, or a long-lived
 * worker replays the exception forever. Reusing the primed generation's project
 * root and input hashes keeps `matchesCachedSource` passing so control reaches
 * the exception path.
 */
async function assertHostExceptionTransformIsEvictedAndRecovers(): Promise<void> {
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();

  cache.set(
    key,
    Promise.resolve({
      ...(good as Record<string, unknown>),
      result: { type: "exception", error: new Error("host exploded") },
    }),
  );

  await assert.rejects(
    () => api.transformTtsc(file, source, options, undefined, cache),
    /host exploded/,
  );
  assert.equal(cache.size, 0, "resolved-exception generation must not persist");

  const recovered = await api.transformTtsc(
    file,
    source,
    options,
    undefined,
    cache,
  );
  assert.ok(recovered, "corrected retry must re-run the transform");
  TestUnpluginProject.assertTransformedToPlugin(recovered.code);
  assert.equal(cache.size, 1);
}

/**
 * Asserts a failed generation's cleanup cannot remove a newer generation
 * another caller installed under the same key.
 *
 * Eviction is identity-guarded: it deletes the entry only when the cache still
 * holds the exact failed generation. This pins that guard by replacing the
 * failed generation with a fresh one after the failing call has begun awaiting
 * but before its rejection eviction runs; the newer generation must survive.
 */
async function assertStaleEvictionKeepsNewerGeneration(): Promise<void> {
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();

  const stale = Promise.reject(new Error("stale generation"));
  stale.catch(() => undefined);
  cache.set(key, stale);
  const newer = Promise.resolve(good);

  // transformTtsc runs synchronously up to `await` on the stale generation, then
  // yields. Swap in the newer generation before the rejection eviction fires.
  const pending = api.transformTtsc(file, source, options, undefined, cache);
  cache.set(key, newer);

  await assert.rejects(() => pending, /stale generation/);
  assert.equal(
    cache.get(key),
    newer,
    "stale generation's eviction must not remove the newer entry",
  );
}

/**
 * Asserts concurrent transforms of one module still compile the project once.
 *
 * The eviction fix must not weaken the single-flight guarantee: two callers
 * racing for the same key share the one in-flight generation stored in the
 * cache. The run-log fixture counts whole-project compiles, so two concurrent
 * `transformTtsc` calls must produce exactly one.
 */
async function assertConcurrentTransformsCompileOnce(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 1 });
  const cache = createTtscTransformCache();
  const file = path.join(project.root, "src", "mod0.ts");
  const source = fs.readFileSync(file, "utf8");
  const options = resolveOptions();

  const [first, second] = await Promise.all([
    transformTtsc(file, source, options, undefined, cache),
    transformTtsc(file, source, options, undefined, cache),
  ]);
  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /PROBED/);
  assert.match(second.code, /PROBED/);

  const pluginRuns = fs.existsSync(project.runLog)
    ? fs.readFileSync(project.runLog, "utf8").length
    : 0;
  assert.equal(pluginRuns, 1, "concurrent callers must share one compile");
}

/**
 * Asserts the first delivery of each module does not re-read the entire
 * project.
 *
 * A project transform already returns output and an input snapshot for every
 * module. Re-hashing all P project files before selecting each of N outputs
 * makes the first build O(N x P), even though no generation has crossed a build
 * boundary. The cache can compare each supplied module source with its snapshot
 * entry and reserve complete validation for a repeated module request.
 */
async function assertFirstModuleDeliveriesDoNotRehashProject(): Promise<void> {
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 24 });
  const modules = projectModules(project.root);
  const sources = new Map(
    modules.map((file) => [file, fs.readFileSync(file, "utf8")]),
  );
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
  const options = resolveOptions();

  const first = modules[0]!;
  assert.ok(
    await transformTtsc(first, sources.get(first)!, options, undefined, cache),
  );

  fs.appendFileSync(
    path.join(project.root, "plugin.cjs"),
    "\n// changed after the build-scoped generation started\n",
    "utf8",
  );
  for (const file of modules.slice(1)) {
    assert.ok(
      await transformTtsc(file, sources.get(file)!, options, undefined, cache),
    );
  }

  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
}

/**
 * Asserts samchon/ttsc#1007: cache-hit sibling deliveries of one graph-bearing
 * generation do not re-probe the filesystem per module.
 *
 * Watch-input derivation must pay the graph's identity computations once per
 * generation; after that a delivery costs only its own memoized lookups. The
 * probe counter observes the shared path-identity resolver's physical-path
 * lookup on every host, so the bound holds identically across CI platforms.
 * Before the fix every delivery re-walked the whole edge set with filesystem
 * work per path, which scaled O(modules x edges) into the #970 residual stall.
 */
async function assertSiblingDeliveriesDoNotReprobeGraph(): Promise<void> {
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const graphFanout = 24;
  const project = createCacheProject({ fileCount: 6, graphFanout });
  const modules = projectModules(project.root);
  const probes = { calls: 0 };
  const cache = createTtscTransformCache({
    realpath: (location: string) => {
      probes.calls += 1;
      return fs.realpathSync.native(location);
    },
  });
  beginTtscTransformBuild(cache);
  const options = resolveOptions();

  // The first delivery compiles, so it needs the real platform for the
  // native spawn; the remaining deliveries are pure cache hits.
  const watched = new Map<string, string[]>();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
      {
        addWatchFile: (input: string) => {
          const list = watched.get(file) ?? [];
          list.push(input);
          watched.set(file, list);
        },
      },
    );
  await deliver(modules[0]!);

  probes.calls = 0;
  for (const file of modules.slice(1)) {
    await deliver(file);
  }

  // Derivation parity: each module registers its own reach union, minus
  // itself, plus the universal config chain.
  const expected = (file: string) =>
    [
      ...modules.filter((other) => other !== file),
      ...Array.from({ length: graphFanout }, (_, index) =>
        path.join(project.root, "node_modules", `dep${index}`, "index.d.ts"),
      ),
      path.join(project.root, "package.json"),
      path.join(project.root, "plugin.cjs"),
      path.join(project.root, "tsconfig.json"),
    ].sort();
  for (const file of modules) {
    assert.deepEqual([...(watched.get(file) ?? [])].sort(), expected(file));
  }

  const perDelivery = probes.calls / (modules.length - 1);
  assert.ok(
    perDelivery <= 24,
    `watch derivation re-probed the filesystem ${perDelivery.toFixed(1)} times per delivery (bound: 24)`,
  );
}

/**
 * Asserts persistent validation reads only each file's graph inputs while
 * retaining freshness for relevant edits and project-membership changes.
 */
async function assertPersistentValidationUsesPerFileInputs(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const count = 12;
  const project = createCacheProject({
    fileCount: count,
    graphFanout: count,
    partitionGraph: true,
    unrelatedDirectoryCount: 48,
  });
  const descriptorSelection = path.join(
    TestProject.tmpdir("ttsc-unplugin-descriptor-selection-"),
    "selection.cjs",
  );
  const descriptorProbes = Array.from({ length: 100 }, (_, index) =>
    path.join(path.dirname(descriptorSelection), `missing-${index}.json`),
  );
  for (const probe of descriptorProbes.filter((_, index) => index % 2 === 0)) {
    fs.writeFileSync(probe, "{}\n", "utf8");
  }
  const directoryProbe = descriptorProbes[3]!;
  fs.mkdirSync(directoryProbe);
  const brokenTarget =
    process.platform === "win32"
      ? undefined
      : path.join(
          TestProject.tmpdir("ttsc-unplugin-broken-host-input-"),
          "selection.json",
        );
  if (brokenTarget !== undefined) {
    // Creating file symlinks requires elevated privileges on Windows. POSIX CI
    // owns this broken-target edge while the shared test retains every other
    // validation and performance assertion on all platforms.
    fs.symlinkSync(brokenTarget, descriptorProbes[1]!, "file");
  }
  fs.writeFileSync(descriptorSelection, 'module.exports = "go-plugin";\n');
  fs.writeFileSync(
    path.join(project.root, "plugin.cjs"),
    [
      'const crypto = require("node:crypto");',
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      `const source = require(${JSON.stringify(descriptorSelection)});`,
      `const hostInputs = ${JSON.stringify(descriptorProbes)};`,
      "const hostInputHashes = Object.fromEntries(hostInputs.map((file) => {",
      '  try { if (fs.statSync(file).isDirectory()) return [file, crypto.createHash("sha256").update("ttsc:host-input:directory\\0").digest("hex")]; } catch {}',
      '  try { return [file, crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]; }',
      "  catch { return [file, null]; }",
      "}));",
      "const hostInputRealpaths = Object.fromEntries(hostInputs.map((file) => {",
      "  try { return [file, fs.realpathSync.native(file)]; }",
      "  catch { return [file, null]; }",
      "}));",
      "",
      "module.exports = (context) => ({",
      '  name: context.plugin.name ?? "cache-probe",',
      "  hostInputHashes,",
      "  hostInputRealpaths,",
      "  hostInputs,",
      "  source: path.resolve(context.dirname, source),",
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  const modules = projectModules(project.root);
  let reads = 0;
  let lstats = 0;
  let stats = 0;
  let deniedDirectory: string | undefined;
  const cache = createTtscTransformCache({
    lstat: (location: string) => {
      lstats += 1;
      return fs.lstatSync(location, { bigint: true });
    },
    readFile: (location: string) => {
      reads += 1;
      return fs.readFileSync(location);
    },
    readdir: (location: string) => {
      if (
        deniedDirectory !== undefined &&
        path.resolve(location) === deniedDirectory
      ) {
        const error = new Error("permission denied") as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
    stat: (location: string) => {
      stats += 1;
      return fs.statSync(location);
    },
    statBigInt: (location: string) => {
      stats += 1;
      return fs.statSync(location, { bigint: true });
    },
  });
  const options = resolveOptions({
    // Force a generated overlay so the per-module bounds also guard the exact
    // temporary-tsconfig exclusion that authorizes narrow validation.
    compilerOptions: { removeComments: true },
  });
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );

  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
  const capturedPromise = [...cache.values()][0]!;
  const capturedGeneration = await capturedPromise;
  const capturedProjectTracker = capturedGeneration.projectMutationTracker;
  const capturedHostTracker = capturedGeneration.hostInputMutationTracker;
  const publishedHashes =
    capturedGeneration.result.type === "exception"
      ? {}
      : (capturedGeneration.result.hostInputHashes ?? {});
  const unhashedInputs =
    capturedGeneration.result.type === "exception"
      ? []
      : (capturedGeneration.result.hostInputs ?? []).filter(
          (input: string) =>
            !Object.prototype.hasOwnProperty.call(
              publishedHashes,
              path.resolve(input),
            ),
        );
  assert.equal(capturedGeneration.projectSnapshotComplete, true);
  assert.match(publishedHashes[directoryProbe] ?? "", /^[0-9a-f]{64}$/);

  reads = 0;
  lstats = 0;
  stats = 0;
  for (const file of modules) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(await deliver(file));
  }
  assert.ok(
    reads / modules.length <= 12,
    `persistent validation read ${(reads / modules.length).toFixed(1)} files per module (bound: 12; complete=${String(capturedGeneration.projectSnapshotComplete)}; projectTracker=${String(capturedProjectTracker?.failed)}/${String(capturedProjectTracker?.membershipChanged)}; hostTracker=${String(capturedHostTracker?.failed)}/${String(capturedHostTracker?.membershipChanged)}; generationReplaced=${String([...cache.values()][0] !== capturedPromise)}; pluginRuns=${fs.existsSync(project.runLog) ? fs.readFileSync(project.runLog, "utf8").length : 0}; hostInputs=${capturedGeneration.result.type === "exception" ? 0 : (capturedGeneration.result.hostInputs?.length ?? 0)}; unhashed=${unhashedInputs.length}:${unhashedInputs.slice(0, 3).join(",")})`,
  );
  assert.ok(
    stats / modules.length <= 12,
    `persistent validation statted ${(stats / modules.length).toFixed(1)} paths per module (bound: 12)`,
  );
  assert.ok(
    lstats / modules.length <= 60,
    `persistent validation metadata-checked ${(lstats / modules.length).toFixed(1)} existing universal inputs per module (bound: 60)`,
  );

  const main = modules[0]!;
  let originalGeneration = [...cache.values()][0];
  deniedDirectory = path.resolve(path.dirname(directoryProbe));
  assert.ok(await deliver(main));
  deniedDirectory = undefined;
  const permissionRetryGeneration = [...cache.values()][0];
  assert.notEqual(
    permissionRetryGeneration,
    originalGeneration,
    "an unreadable proving directory cannot certify that candidates remain missing",
  );
  originalGeneration = permissionRetryGeneration;
  fs.writeFileSync(
    path.join(project.root, "node_modules", "dep1", "index.d.ts"),
    "export declare const unrelated: string;\n",
    "utf8",
  );
  assert.ok(await deliver(main));
  assert.equal(
    [...cache.values()][0],
    originalGeneration,
    "an unreachable external edit must not replace the file's generation",
  );

  fs.writeFileSync(
    path.join(project.root, "fixtures", "unused-0", "nested", "asset.txt"),
    "changed unrelated fixture asset\n",
    "utf8",
  );
  assert.ok(await deliver(main));
  assert.equal(
    [...cache.values()][0],
    originalGeneration,
    "an unclassified project asset must not replace the generation",
  );

  let linkedGeneration = originalGeneration;
  if (brokenTarget !== undefined) {
    fs.writeFileSync(brokenTarget, "{}\n", "utf8");
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(await deliver(main));
    linkedGeneration = [...cache.values()][0];
    assert.notEqual(
      linkedGeneration,
      originalGeneration,
      "a broken host-input link whose remote target appears must replace the generation",
    );
  }

  fs.writeFileSync(
    path.join(project.root, "node_modules", "dep0", "index.d.ts"),
    "export declare const relevant: string;\n",
    "utf8",
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(await deliver(main));
  const relevantGeneration = [...cache.values()][0];
  assert.notEqual(
    relevantGeneration,
    linkedGeneration,
    "a reachable external edit must replace the file's generation",
  );

  fs.writeFileSync(
    path.join(project.root, "src", "new-global.d.ts"),
    "declare const newlyIncluded: string;\n",
    "utf8",
  );
  assert.ok(await deliver(main));
  assert.notEqual(
    [...cache.values()][0],
    relevantGeneration,
    "a project-membership change must replace the generation",
  );

  const membershipGeneration = [...cache.values()][0];
  const nextPlugin = path.join(project.root, "go-plugin-next");
  fs.cpSync(path.join(project.root, "go-plugin"), nextPlugin, {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(nextPlugin, "go.mod"),
    "module example.com/ttscunplugincacheprobenext\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(nextPlugin, "main.go"),
    fs
      .readFileSync(path.join(nextPlugin, "main.go"), "utf8")
      .replace('"PROBED"', '"DESCRIPTOR-RELOADED"'),
    "utf8",
  );
  fs.writeFileSync(
    descriptorSelection,
    'module.exports = "go-plugin-next";\n',
    "utf8",
  );
  const reloaded = await deliver(main);
  assert.ok(reloaded);
  assert.notEqual(
    [...cache.values()][0],
    membershipGeneration,
    "an out-of-project descriptor dependency edit must replace the generation",
  );
  assert.match(
    reloaded.code,
    /DESCRIPTOR-RELOADED/,
    "the replacement generation must reload the changed descriptor dependency",
  );
}

/**
 * Asserts a generation whose watchers cannot be registered still validates.
 *
 * Folding watcher health into the generation's own completeness flag left an
 * entry that neither validation path would accept, so every delivery evicted it
 * and re-ran a whole-project compile — the state an inotify-exhausted or
 * network-filesystem dev server lands in. Losing notifications must cost the
 * narrow path, not the cache, and the recorded snapshot must keep proving every
 * class of change on its own.
 */
async function assertUnavailableNotificationsKeepThePersistentCache(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 6 });
  const modules = projectModules(project.root);
  const cache = createTtscTransformCache({
    watch: () => {
      const error = new Error(
        "watch registration refused",
      ) as NodeJS.ErrnoException;
      error.code = "ENOSPC";
      throw error;
    },
  });
  const options = resolveOptions();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const pluginRuns = (): number =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;

  for (const file of modules) {
    const result = await deliver(file);
    assert.ok(result);
    assert.match(result.code, /PROBED/);
  }
  assert.equal(
    pluginRuns(),
    1,
    "a generation with no notifications must still be validated from its snapshot",
  );
  const generation = [...cache.values()][0];
  assert.equal(
    (await generation!).projectMutationTracker,
    undefined,
    "an unusable watcher must not be attached to the generation",
  );

  // Every change class must still invalidate without a single notification.
  fs.writeFileSync(
    path.join(project.root, "src", "mod4.ts"),
    'export const value4: string = "PROBE-EDITED";\n',
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(pluginRuns(), 2, "an edited project source must recompile");

  fs.writeFileSync(
    path.join(project.root, "src", "added.d.ts"),
    "declare const added: string;\n",
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(pluginRuns(), 3, "a new project input must recompile");

  fs.writeFileSync(
    path.join(project.root, "node_modules", "dep2", "index.d.ts"),
    "export declare const dep2: string;\n",
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    4,
    "an edited out-of-walk graph member must recompile",
  );

  fs.rmSync(path.join(project.root, "src", "added.d.ts"));
  assert.ok(await deliver(modules[0]!));
  assert.equal(pluginRuns(), 5, "a removed project input must recompile");

  // A steady project must then stop recompiling.
  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(
    pluginRuns(),
    5,
    "a steady project must not recompile once its snapshot matches again",
  );
}

/**
 * Asserts one failed tracker is enough to leave the narrow path.
 *
 * Membership has two halves — the project walk and the universal inputs — and a
 * generation may take the narrow path only while both are still proven by
 * notification. The neighbouring cases refuse or fail every watcher at once, so
 * a regression that consulted a single tracker would keep them green while
 * serving a module whose universal inputs nothing is watching.
 */
async function assertOneFailedTrackerFallsBackToCompleteValidation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 6 });
  const modules = projectModules(project.root);
  const cache = createTtscTransformCache({
    watch: () => {
      // The project tracker registers before the compile and the host-input
      // tracker after it, so the fixture's own run log separates the two
      // phases: this refuses the host-input registrations and no others.
      if (!fs.existsSync(project.runLog)) {
        return { close: () => undefined };
      }
      const error = new Error(
        "watch registration refused",
      ) as NodeJS.ErrnoException;
      error.code = "ENOSPC";
      throw error;
    },
  });
  const options = resolveOptions();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const pluginRuns = (): number =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;

  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(
    pluginRuns(),
    1,
    "one unusable tracker must not cost the cache its generation",
  );
  const generation = await [...cache.values()][0]!;
  assert.equal(
    generation.hostInputMutationTracker,
    undefined,
    "the tracker that could not register must not be attached",
  );
  assert.equal(
    generation.projectMutationTracker,
    undefined,
    "its healthy sibling must not be attached either: the narrow path needs both",
  );

  fs.writeFileSync(
    path.join(project.root, "src", "mod3.ts"),
    'export const value3: string = "PROBE-EDITED";\n',
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    2,
    "an edit must still invalidate through the fallback",
  );
}

/**
 * Asserts a watcher that fails after generation falls back instead of evicting.
 *
 * A failed notification is the absence of a membership proof, never evidence of
 * a change. The generation must keep serving through complete-snapshot
 * validation, while a real membership event — which is evidence — still
 * replaces it.
 */
async function assertFailedNotificationsFallBackToCompleteValidation(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 6, graphFanout: 6 });
  const modules = projectModules(project.root);
  const failures: (() => void)[] = [];
  const cache = createTtscTransformCache({
    watch: (_directory, _listener, onError) => {
      failures.push(onError);
      return { close: () => undefined };
    },
  });
  const options = resolveOptions();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const pluginRuns = (): number =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;

  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(pluginRuns(), 1);
  const generation = [...cache.values()][0];
  assert.notEqual(
    (await generation!).projectMutationTracker,
    undefined,
    "a healthy watcher must be attached so the narrow path stays available",
  );

  // The watchers stop reporting after the generation was produced.
  assert.ok(failures.length > 0, "the seam must have registered a watcher");
  for (const fail of failures) {
    fail();
  }
  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(
    pluginRuns(),
    1,
    "a failed watcher must fall back to complete validation, not evict",
  );
  assert.equal(
    [...cache.values()][0],
    generation,
    "the fallback must keep the same generation",
  );

  fs.writeFileSync(
    path.join(project.root, "src", "mod2.ts"),
    'export const value2: string = "PROBE-EDITED";\n',
    "utf8",
  );
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    2,
    "an edit must still invalidate once notifications have failed",
  );
}

/**
 * Asserts a generation proves each shared input once instead of once per
 * delivered module, without loosening any invalidation.
 *
 * {@link assertPersistentValidationUsesPerFileInputs} partitions the graph so
 * every module owns a disjoint external input, which hides the cost this pins:
 * a real program gives every module the same reachable closure and the same
 * `graph.globals`, so re-reading each delivered file's inputs multiplies one
 * generation's proven bytes by the module count. The bound below is met only
 * when an unchanged metadata signature stands in for the content comparison,
 * and only when one physical file's two spellings each keep their own proof
 * instead of overwriting it.
 */
async function assertPersistentValidationProvesSharedInputsOnce(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const count = 8;
  const shared = 24;
  const project = createCacheProject({
    aliasedGlobal: true,
    fileCount: count,
    graphFanout: shared,
    graphGlobals: shared,
  });
  const modules = projectModules(project.root);
  let reads = 0;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      reads += 1;
      return fs.readFileSync(location);
    },
  });
  const options = resolveOptions();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
  const pluginRuns = (): number =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;

  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  assert.equal(pluginRuns(), 1);

  reads = 0;
  for (const file of modules) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(await deliver(file));
  }
  assert.equal(pluginRuns(), 1, "a steady generation must not recompile");
  // Every module reaches every sibling plus `shared` externals, `shared`
  // globals and one aliased spelling of a global, so the pre-fix path read ~56
  // files per delivery here. Only the generation's own current file lacks a
  // disk signature (its recorded hash came from the bundler's buffer), so a
  // proven generation reads at most that, and the bound keeps one slot of
  // headroom. It also fails if the alias and its target overwrite each other's
  // proof, which costs two more reads per delivery on every POSIX host.
  assert.ok(
    reads / modules.length <= 2,
    `persistent validation read ${(reads / modules.length).toFixed(1)} files per module for a shared closure (bound: 2)`,
  );

  // One delivery in isolation: only the generation's own current file may be
  // read. A second read means the aliased global lost its own proof to its
  // target's, which a per-identity manifest does on every delivery.
  reads = 0;
  assert.ok(await deliver(modules[1]!));
  assert.ok(
    reads <= 1,
    `an aliased spelling must keep its own proof (read ${reads} files)`,
  );

  // A metadata-only change must revalidate by content, keep the generation, and
  // then stop being re-read.
  const touched = path.join(
    project.root,
    "node_modules",
    "global0",
    "index.d.ts",
  );
  const shifted = new Date(Date.now() + 4000);
  fs.utimesSync(touched, shifted, shifted);
  const beforeTouch = [...cache.values()][0];
  reads = 0;
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    [...cache.values()][0],
    beforeTouch,
    "a metadata-only change must not replace the generation",
  );
  assert.ok(
    reads >= 1,
    "a changed metadata signature must fall back to the content comparison",
  );
  reads = 0;
  assert.ok(await deliver(modules[1]!));
  // Exactly one read is available to this delivery: the generation's own
  // current file, whose recorded hash came from the bundler's buffer and so
  // carries no disk signature. A second read means the touched global was not
  // re-proven and is being reread on every delivery.
  assert.ok(
    reads <= 1,
    `a revalidated input must be proven again, not reread per delivery (read ${reads})`,
  );

  // The globals half must still invalidate every module, not just one.
  fs.writeFileSync(touched, "declare const ambient0: string;\n", "utf8");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(await deliver(modules[2]!));
  assert.notEqual(
    [...cache.values()][0],
    beforeTouch,
    "an edited global-scope declaration must replace the generation",
  );
  assert.equal(pluginRuns(), 2, "the edited global must force one recompile");

  // A reachable external edit must still invalidate through the same path.
  const generationAfterGlobal = [...cache.values()][0];
  fs.writeFileSync(
    path.join(project.root, "node_modules", "dep3", "index.d.ts"),
    "export declare const dep3: string;\n",
    "utf8",
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(await deliver(modules[3]!));
  assert.notEqual(
    [...cache.values()][0],
    generationAfterGlobal,
    "a reachable external edit must replace the generation",
  );

  // And so must a project-membership change.
  const generationAfterExternal = [...cache.values()][0];
  fs.writeFileSync(
    path.join(project.root, "src", "added.d.ts"),
    "declare const added: string;\n",
    "utf8",
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(await deliver(modules[4]!));
  assert.notEqual(
    [...cache.values()][0],
    generationAfterExternal,
    "a project-membership change must replace the generation",
  );

  // A sibling source edit must still be seen by the modules that reach it.
  const generationAfterMembership = [...cache.values()][0];
  fs.writeFileSync(
    path.join(project.root, "src", "mod5.ts"),
    'export const value5: string = "PROBE-EDITED";\n',
    "utf8",
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(await deliver(modules[6]!));
  assert.notEqual(
    [...cache.values()][0],
    generationAfterMembership,
    "an edited reachable project source must replace the generation",
  );
}

/**
 * Asserts a generation-time walk failure cannot bless a partial snapshot as a
 * permanently valid narrow cache entry.
 */
async function assertIncompleteProjectSnapshotFallsBackAndRecovers(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const transientDirectory = path.join(project.root, "src", "transient");
  fs.mkdirSync(transientDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const hiddenDuringSnapshot: string;\n",
    "utf8",
  );
  let failureMode: "once" | "repeated" | undefined = "once";
  let failed = false;
  let repeatedFailures = 0;
  const cache = createTtscTransformCache({
    readdir: (location: string) => {
      if (
        path.resolve(location) === transientDirectory &&
        failureMode === "once" &&
        !failed &&
        fs.existsSync(project.runLog)
      ) {
        failed = true;
        throw new Error("transient project snapshot failure");
      }
      if (
        path.resolve(location) === transientDirectory &&
        failureMode === "repeated"
      ) {
        repeatedFailures += 1;
        throw new Error("repeated project snapshot failure");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");

  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal(failed, true, "the generation walk must exercise the failure");
  const incompleteGeneration = [...cache.values()][0];

  failureMode = "repeated";
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const changedWhileHidden: string;\n",
    "utf8",
  );
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.ok(repeatedFailures >= 2);
  assert.notEqual(
    [...cache.values()][0],
    incompleteGeneration,
    "two matching partial walks must never authorize the old generation",
  );
  const repeatedIncompleteGeneration = [...cache.values()][0];

  failureMode = undefined;
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.notEqual(
    [...cache.values()][0],
    repeatedIncompleteGeneration,
    "a recovered complete walk must replace the partial generation",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 3);
}

/**
 * Asserts a project edit between native compilation and snapshot publication
 * cannot become an authoritative stale generation.
 */
async function assertCompileSnapshotRaceCannotAuthorizeStaleOutput(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");
  let raced = false;
  const cache = createTtscTransformCache({
    readdir: (location: string) => {
      if (
        !raced &&
        fs.existsSync(project.runLog) &&
        path.resolve(location) === path.dirname(lazy)
      ) {
        raced = true;
        fs.writeFileSync(
          lazy,
          'export const value1: string = "PROBE-AFTER";\n',
          "utf8",
        );
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal(raced, true);

  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.match(result.code, /AFTER/);
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "the torn generation must be replaced before its stale sibling output is served",
  );
}

/**
 * Asserts a project input changed and restored during native compilation cannot
 * pair the transient output with the identical pre/post filesystem snapshots.
 */
async function assertCompileSnapshotAbaRaceCannotAuthorizeStaleOutput(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 2,
    graphFanout: 2,
    snapshotAbaRace: true,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");

  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  const firstGeneration = [...cache.values()][0];
  assert.equal(
    fs.readFileSync(lazy, "utf8"),
    'export const value1: string = "PROBE";\n',
  );

  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.doesNotMatch(result.code, /DURING/);
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "an ABA mutation during compilation must prevent persistent reuse",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}

/** Independent graph leaves must retain the same compiler-proof invariant. */
async function assertIndependentGraphLeafCompileSnapshotAbaRaceCannotAuthorizeStaleOutput(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 2,
    graphFanout: 1,
    independentGraphLeaf: "src/mod1.ts",
    snapshotAbaRace: true,
  });
  const cache = createTtscTransformCache();
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");

  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  const firstGeneration = [...cache.values()][0];
  assert.equal(
    fs.readFileSync(lazy, "utf8"),
    'export const value1: string = "PROBE";\n',
  );

  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.doesNotMatch(result.code, /DURING/);
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "an independent leaf's compiler proof must reject ABA output",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}

/** External graph input A-B-A churn obeys the same generation invariant. */
async function assertExternalCompileSnapshotAbaRaceCannotAuthorizeStaleOutput(): Promise<void> {
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSnapshotAbaRace: true,
    fileCount: 2,
    graphFanout: 1,
  });
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const lazy = path.join(project.root, "src", "mod1.ts");

  const first = await transformTtsc(
    main,
    fs.readFileSync(main, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(first);
  assert.match(first.code, /EXTERNAL-DURING/);
  const firstGeneration = [...cache.values()][0];

  const second = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(second);
  assert.doesNotMatch(second.code, /EXTERNAL-DURING/);
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "compiler-time external proof must reject restored post-compile bytes",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}

/**
 * Asserts a module candidate created after descriptor resolution cannot bless
 * the earlier descriptor result with the later filesystem state.
 */
async function assertDescriptorInputRaceCannotAuthorizeStaleGeneration(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 1, graphFanout: 1 });
  const external = TestProject.tmpdir("ttsc-unplugin-descriptor-race-");
  const selectionBase = path.join(external, "selection");
  const selectionJson = `${selectionBase}.json`;
  const selectionJs = `${selectionBase}.js`;
  fs.writeFileSync(
    selectionJson,
    JSON.stringify(path.join(project.root, "go-plugin")),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project.root, "plugin.cjs"),
    [
      'const fs = require("node:fs");',
      `const source = require(${JSON.stringify(selectionBase)});`,
      "module.exports = () => {",
      `  fs.writeFileSync(${JSON.stringify(selectionJs)}, ${JSON.stringify(`module.exports = ${JSON.stringify(path.join(project.root, "go-plugin"))};\n`)}, "utf8");`,
      '  return { name: "descriptor-race", source };',
      "};",
      "",
    ].join("\n"),
    "utf8",
  );

  const cache = createTtscTransformCache();
  const options = resolveOptions();
  const main = path.join(project.root, "src", "mod0.ts");
  const source = fs.readFileSync(main, "utf8");
  assert.ok(await transformTtsc(main, source, options, undefined, cache));
  assert.ok(fs.existsSync(selectionJs));
  const firstGeneration = [...cache.values()][0];

  assert.ok(await transformTtsc(main, source, options, undefined, cache));
  assert.notEqual(
    [...cache.values()][0],
    firstGeneration,
    "a candidate created during descriptor evaluation must replace the torn generation",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
}

/**
 * Asserts a cache with no build-start lifecycle validates every generation hit,
 * including a module that generation has not served before.
 */
async function assertPersistentCacheValidatesAnUnservedModule(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "fixture",
        operation: "echo-file",
        path: "src/lazy.ts",
      },
    ],
  });
  const lazy = path.join(root, "src", "lazy.ts");
  fs.writeFileSync(lazy, "export const lazy = 1;\n", "utf8");
  const cache = createTtscTransformCache();
  const options = resolveOptions();

  assert.ok(
    await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
    ),
  );
  const oldGeneration = [...cache.values()][0];
  assert.ok(oldGeneration);

  fs.appendFileSync(path.join(root, "plugin.cjs"), "\n// changed input\n");
  const result = await transformTtsc(
    lazy,
    fs.readFileSync(lazy, "utf8"),
    options,
    undefined,
    cache,
  );
  assert.ok(result);
  assert.match(result.code, /ttsc-fixture/);
  assert.notEqual(
    [...cache.values()][0],
    oldGeneration,
    "a persistent cache must validate unrelated inputs before first delivery",
  );
}

/**
 * Asserts a stale input-mismatch cleanup neither deletes nor bypasses a newer
 * generation installed while the stale Promise was pending.
 */
async function assertStaleMismatchUsesNewerGeneration(): Promise<void> {
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();

  let resolveStale!: (value: unknown) => void;
  const stale = new Promise<unknown>((resolve) => {
    resolveStale = resolve;
  });
  cache.set(key, stale);
  const pending = api.transformTtsc(file, source, options, undefined, cache);

  const newer = Promise.resolve(good);
  cache.set(key, newer);
  resolveStale({
    ...(good as Record<string, unknown>),
    inputHashes: {},
  });

  const result = await pending;
  assert.ok(result);
  TestUnpluginProject.assertTransformedToPlugin(result.code);
  assert.equal(
    cache.get(key),
    newer,
    "a stale mismatch must retry the authoritative newer generation",
  );
}

/**
 * Asserts a caller awaiting an old but otherwise matching generation retries
 * when a sibling caller replaces that generation.
 */
async function assertSupersededMatchingGenerationIsNotServed(): Promise<void> {
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();
  const goodRecord = good as {
    result: {
      typescript: Record<string, string>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  const outputKey = Object.keys(goodRecord.result.typescript)[0]!;
  const staleValue = {
    ...goodRecord,
    result: {
      ...goodRecord.result,
      typescript: {
        ...goodRecord.result.typescript,
        [outputKey]: "export const marker = 'STALE';\n",
      },
    },
  };

  let resolveStale!: (value: unknown) => void;
  const stale = new Promise<unknown>((resolve) => {
    resolveStale = resolve;
  });
  cache.set(key, stale);
  const mismatching = api.transformTtsc(
    file,
    `${source}\n// mismatching caller\n`,
    options,
    undefined,
    cache,
  );
  const matching = api.transformTtsc(file, source, options, undefined, cache);
  resolveStale(staleValue);

  const matchingResult = await matching;
  assert.ok(matchingResult);
  assert.doesNotMatch(
    matchingResult.code,
    /STALE/,
    "a matching waiter must not return a generation another caller superseded",
  );
  assert.ok(await mismatching);
  assert.notEqual(cache.get(key), stale);
}

/** Absolute, sorted list of the project's `src/*.ts` modules. */
function projectModules(root: string): string[] {
  const srcDir = path.join(root, "src");
  return fs
    .readdirSync(srcDir)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => path.join(srcDir, name));
}

function createCacheProject(options: ICacheProjectOptions): {
  root: string;
  runLog: string;
} {
  const root = TestProject.tmpdir("ttsc-unplugin-cache-project-");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-cache-log-"),
    "plugin-runs.log",
  );
  const fileCount = options.fileCount ?? 6;
  const snapshotRaceFile = path.join(root, "src", "mod1.ts");
  const snapshotRaceMarker = path.join(
    TestProject.tmpdir("ttsc-unplugin-cache-race-"),
    "mutated",
  );
  const snapshotRaceOriginal = 'export const value1: string = "PROBE";\n';
  const snapshotRaceDuring = 'export const value1: string = "PROBE-DURING";\n';
  const externalRaceFile = path.join(
    TestProject.tmpdir("ttsc-unplugin-external-race-"),
    "external.d.ts",
  );
  if (options.externalSnapshotAbaRace === true) {
    fs.writeFileSync(externalRaceFile, "EXTERNAL-ORIGINAL\n", "utf8");
  }
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  for (let index = 0; index < fileCount; index += 1) {
    fs.writeFileSync(
      path.join(root, "src", `mod${index}.ts`),
      `export const value${index}: string = "PROBE";\n`,
      "utf8",
    );
  }
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  for (
    let index = 0;
    index < (options.unrelatedDirectoryCount ?? 0);
    index += 1
  ) {
    const directory = path.join(root, "fixtures", `unused-${index}`, "nested");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "asset.txt"), "fixture\n", "utf8");
  }
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: "dist",
          // Options live at the plugin-entry top level: the protocol forwards
          // the whole entry as the plugin's config object.
          plugins: [
            {
              transform: "./plugin.cjs",
              name: "cache-probe",
              runLog,
              emitExternal: options.emitExternalKey === true,
              aliasedGlobal:
                options.aliasedGlobal === true && process.platform !== "win32",
              graphFanout: options.graphFanout ?? 0,
              graphGlobals: options.graphGlobals ?? 0,
              independentGraphLeaf: options.independentGraphLeaf,
              partitionGraph: options.partitionGraph === true,
              ...(options.snapshotAbaRace === true
                ? {
                    snapshotRaceDuring,
                    snapshotRaceFile,
                    snapshotRaceMarker,
                    snapshotRaceOriginal,
                  }
                : {}),
              ...(options.externalSnapshotAbaRace === true
                ? {
                    externalRaceFile,
                    externalRaceOriginal: "EXTERNAL-ORIGINAL\n",
                    snapshotRaceDuring: "EXTERNAL-DURING\n",
                    snapshotRaceFile: externalRaceFile,
                    snapshotRaceMarker,
                  }
                : {}),
            },
          ],
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      "",
      "module.exports = (context) => {",
      "  return {",
      '    name: context.plugin.name ?? "cache-probe",',
      '    source: path.resolve(context.dirname, "go-plugin"),',
      "  };",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  if (options.emitExternalKey === true) {
    // The validator's directory walk skips node_modules; this file only has to
    // exist so the pre-fix store-side overlay could read and key it.
    const depDir = path.join(root, "node_modules", "dep");
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, "index.d.ts"), "export {};\n", "utf8");
  }
  const graphFanout = options.graphFanout ?? 0;
  for (let index = 0; index < graphFanout; index += 1) {
    // The graph envelope's external targets must exist: the store-time
    // snapshot hashes every recorded external input.
    const depDir = path.join(root, "node_modules", `dep${index}`);
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(
      path.join(depDir, "index.d.ts"),
      `export declare const dep${index}: number;\n`,
      "utf8",
    );
  }
  for (let index = 0; index < (options.graphGlobals ?? 0); index += 1) {
    // Global-scope declarations the envelope reports for every module. They sit
    // outside the project walk exactly like a real `@types/*` package.
    const globalDir = path.join(root, "node_modules", `global${index}`);
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(
      path.join(globalDir, "index.d.ts"),
      `declare const ambient${index}: number;\n`,
      "utf8",
    );
  }
  if (options.aliasedGlobal === true && process.platform !== "win32") {
    // One physical file under two spellings: the alias and its target share an
    // identity but not their metadata.
    const globalDir = path.join(root, "node_modules", "global0");
    fs.symlinkSync(
      path.join(globalDir, "index.d.ts"),
      path.join(globalDir, "alias.d.ts"),
      "file",
    );
  }
  writeGoPlugin(root);
  return { root, runLog };
}

/**
 * Write the multi-file counting transform sidecar.
 *
 * It echoes every `src/*.ts` file (rewriting the `PROBE` marker so output
 * differs from input), appends one byte to the configured `runLog` per
 * invocation so the test can count whole-project transforms, and optionally
 * emits one out-of-walk output key.
 */
function writeGoPlugin(root: string): void {
  const dir = path.join(root, "go-plugin");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "go.mod"),
    "module example.com/ttscunplugincacheprobe\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(dir, "main.go"),
    [
      "package main",
      "",
      "import (",
      '  "crypto/sha256"',
      '  "encoding/json"',
      '  "flag"',
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      '  "strings"',
      ")",
      "",
      "type pluginDescriptor struct {",
      '  Config map[string]any `json:"config"`',
      "}",
      "",
      "type graphSection struct {",
      '  Edges   map[string][]string `json:"edges"`',
      '  Globals []string            `json:"globals"`',
      '  Configs []string            `json:"configs"`',
      '  InputHashes map[string]*string `json:"inputHashes,omitempty"`',
      '  InputRealpaths map[string]*string `json:"inputRealpaths,omitempty"`',
      "}",
      "",
      "type transformResult struct {",
      '  TypeScript map[string]string `json:"typescript"`',
      '  Graph      *graphSection     `json:"graph,omitempty"`',
      "}",
      "",
      "func main() { os.Exit(run(os.Args[1:])) }",
      "",
      "func run(args []string) int {",
      "  if len(args) == 0 { return 2 }",
      "  switch args[0] {",
      '  case "transform":',
      "    return transform(args[1:])",
      '  case "check", "version", "build":',
      "    return 0",
      "  default:",
      '    fmt.Fprintf(os.Stderr, "cache-probe: unknown command %q\\n", args[0])',
      "    return 2",
      "  }",
      "}",
      "",
      "func transform(args []string) int {",
      '  fs := flag.NewFlagSet("transform", flag.ContinueOnError)',
      "  fs.SetOutput(os.Stderr)",
      '  cwd := fs.String("cwd", "", "")',
      '  fs.String("tsconfig", "", "")',
      '  pluginsJSON := fs.String("plugins-json", "", "")',
      "  if err := fs.Parse(args); err != nil { return 2 }",
      "  root := *cwd",
      '  if root == "" { root, _ = os.Getwd() }',
      "  cfg := firstConfig(*pluginsJSON)",
      "",
      '  if logPath := stringValue(cfg, "runLog"); logPath != "" {',
      "    if f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {",
      '      f.WriteString("x")',
      "      f.Close()",
      "    }",
      "  }",
      "",
      "  ts := map[string]string{}",
      "  observedInputs := map[string]string{}",
      '  srcDir := filepath.Join(root, "src")',
      "  entries, err := os.ReadDir(srcDir)",
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "  names := []string{}",
      "  for _, e := range entries {",
      '    if e.IsDir() || !strings.HasSuffix(e.Name(), ".ts") { continue }',
      "    names = append(names, e.Name())",
      "  }",
      "  for _, name := range names {",
      "    file := filepath.Join(srcDir, name)",
      '    raceFile := stringValue(cfg, "snapshotRaceFile")',
      '    raceMarker := stringValue(cfg, "snapshotRaceMarker")',
      '    if raceFile != "" && filepath.Clean(file) == filepath.Clean(raceFile) && raceMarker != "" {',
      "      if _, statErr := os.Stat(raceMarker); os.IsNotExist(statErr) {",
      '        os.WriteFile(raceMarker, []byte("1"), 0o644)',
      '        os.WriteFile(file, []byte(stringValue(cfg, "snapshotRaceDuring")), 0o644)',
      "      }",
      "    }",
      "    data, err := os.ReadFile(file)",
      "    if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '    input := "src/"+name',
      "    observedInputs[input] = string(data)",
      '    ts[input] = strings.ReplaceAll(string(data), "PROBE", "PROBED")',
      '    if raceFile != "" && filepath.Clean(file) == filepath.Clean(raceFile) && stringValue(cfg, "snapshotRaceOriginal") != "" {',
      '      if err := os.WriteFile(raceFile, []byte(stringValue(cfg, "snapshotRaceOriginal")), 0o644); err != nil { fmt.Fprintln(os.Stderr, err); return 2 }',
      "    }",
      "  }",
      '  externalRaceFile := stringValue(cfg, "externalRaceFile")',
      '  externalRaceOriginal := stringValue(cfg, "externalRaceOriginal")',
      '  externalRaceText := ""',
      '  if externalRaceFile != "" {',
      '    raceMarker := stringValue(cfg, "snapshotRaceMarker")',
      '    if raceMarker != "" {',
      "      if _, statErr := os.Stat(raceMarker); os.IsNotExist(statErr) {",
      '        os.WriteFile(raceMarker, []byte("1"), 0o644)',
      '        os.WriteFile(externalRaceFile, []byte(stringValue(cfg, "snapshotRaceDuring")), 0o644)',
      "      }",
      "    }",
      "    data, readErr := os.ReadFile(externalRaceFile)",
      "    if readErr != nil { fmt.Fprintln(os.Stderr, readErr); return 2 }",
      "    externalRaceText = string(data)",
      "    observedInputs[externalRaceFile] = externalRaceText",
      '    for key, value := range ts { ts[key] = value + "// " + strings.TrimSpace(externalRaceText) + "\\n" }',
      '    if externalRaceOriginal != "" {',
      "      if writeErr := os.WriteFile(externalRaceFile, []byte(externalRaceOriginal), 0o644); writeErr != nil { fmt.Fprintln(os.Stderr, writeErr); return 2 }",
      "    }",
      "  }",
      '  if boolValue(cfg, "emitExternal") {',
      '    ts["node_modules/dep/index.d.ts"] = "export {};\\n"',
      "  }",
      "",
      "  result := transformResult{TypeScript: ts}",
      '  if fanout := int(numberValue(cfg, "graphFanout")); fanout > 0 {',
      "    externals := make([]string, 0, fanout)",
      "    for j := 0; j < fanout; j++ {",
      '      externals = append(externals, fmt.Sprintf("node_modules/dep%d/index.d.ts", j))',
      "    }",
      "    edges := map[string][]string{}",
      "    for i, name := range names {",
      "      targets := []string{}",
      '      independentGraphLeaf := stringValue(cfg, "independentGraphLeaf")',
      '      if independentGraphLeaf != "" {',
      '        if "src/"+name != independentGraphLeaf { targets = append(targets, externals...) }',
      '      } else if boolValue(cfg, "partitionGraph") {',
      "        targets = append(targets, externals[i%len(externals)])",
      "      } else {",
      "        for _, other := range names {",
      '          if other != name { targets = append(targets, "src/"+other) }',
      "        }",
      "        targets = append(targets, externals...)",
      "      }",
      '      edges["src/"+name] = targets',
      "    }",
      "    result.Graph = &graphSection{",
      "      Edges:      edges,",
      "      Globals:    []string{},",
      '      Configs:    []string{"tsconfig.json"},',
      "      InputHashes: map[string]*string{},",
      "      InputRealpaths: map[string]*string{},",
      "    }",
      "    for input, observed := range observedInputs { addGraphInputProof(result.Graph, root, input, observed) }",
      '    addGraphInputProof(result.Graph, root, "tsconfig.json", "")',
      '    for _, input := range externals { addGraphInputProof(result.Graph, root, input, "") }',
      '    if boolValue(cfg, "aliasedGlobal") {',
      '      alias := "node_modules/global0/alias.d.ts"',
      "      result.Graph.Globals = append(result.Graph.Globals, alias)",
      '      addGraphInputProof(result.Graph, root, alias, "")',
      "    }",
      '    for j := 0; j < int(numberValue(cfg, "graphGlobals")); j++ {',
      '      global := fmt.Sprintf("node_modules/global%d/index.d.ts", j)',
      "      result.Graph.Globals = append(result.Graph.Globals, global)",
      '      addGraphInputProof(result.Graph, root, global, "")',
      "    }",
      '    if externalRaceFile != "" {',
      '      result.Graph.Edges["src/mod0.ts"] = append(result.Graph.Edges["src/mod0.ts"], externalRaceFile)',
      "      addGraphInputProof(result.Graph, root, externalRaceFile, externalRaceText)",
      "    }",
      "  }",
      "",
      "  data, _ := json.Marshal(result)",
      "  fmt.Fprintln(os.Stdout, string(data))",
      "  return 0",
      "}",
      "",
      "func addGraphInputProof(graph *graphSection, root, input, observed string) {",
      "  file := input",
      "  if !filepath.IsAbs(file) { file = filepath.Join(root, filepath.FromSlash(file)) }",
      "  data := []byte(observed)",
      '  if observed == "" { data, _ = os.ReadFile(file) }',
      "  digest := sha256.Sum256(data)",
      '  hash := fmt.Sprintf("%x", digest[:])',
      "  realpath, err := filepath.EvalSymlinks(file)",
      "  if err != nil { graph.InputHashes[input] = nil; graph.InputRealpaths[input] = nil; return }",
      "  absolute, err := filepath.Abs(realpath)",
      "  if err != nil { return }",
      "  graph.InputHashes[input] = &hash",
      "  graph.InputRealpaths[input] = &absolute",
      "}",
      "",
      "func firstConfig(input string) map[string]any {",
      '  if input == "" { return nil }',
      "  var plugins []pluginDescriptor",
      "  if err := json.Unmarshal([]byte(input), &plugins); err != nil { return nil }",
      "  if len(plugins) == 0 { return nil }",
      "  return plugins[0].Config",
      "}",
      "",
      "func stringValue(config map[string]any, key string) string {",
      "  value, _ := config[key].(string)",
      "  return value",
      "}",
      "",
      "func boolValue(config map[string]any, key string) bool {",
      "  value, _ := config[key].(bool)",
      "  return value",
      "}",
      "",
      "func numberValue(config map[string]any, key string) float64 {",
      "  value, _ := config[key].(float64)",
      "  return value",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

export {
  assertCacheHitsDespiteOutOfWalkOutputKey,
  assertCacheTransformsMultiFileProjectOnce,
  assertCompileSnapshotRaceCannotAuthorizeStaleOutput,
  assertCompileSnapshotAbaRaceCannotAuthorizeStaleOutput,
  assertIndependentGraphLeafCompileSnapshotAbaRaceCannotAuthorizeStaleOutput,
  assertExternalCompileSnapshotAbaRaceCannotAuthorizeStaleOutput,
  assertFilesystemOperationsAreCacheLocal,
  assertDescriptorInputRaceCannotAuthorizeStaleGeneration,
  assertConcurrentTransformsCompileOnce,
  assertFirstModuleDeliveriesDoNotRehashProject,
  assertHostExceptionTransformIsEvictedAndRecovers,
  assertIncompleteProjectSnapshotFallsBackAndRecovers,
  assertPersistentCacheValidatesAnUnservedModule,
  assertFailedNotificationsFallBackToCompleteValidation,
  assertOneFailedTrackerFallsBackToCompleteValidation,
  assertPersistentValidationProvesSharedInputsOnce,
  assertPersistentValidationUsesPerFileInputs,
  assertRejectedTransformIsEvictedAndRecovers,
  assertSiblingDeliveriesDoNotReprobeGraph,
  assertStaleEvictionKeepsNewerGeneration,
  assertStaleMismatchUsesNewerGeneration,
  assertSupersededMatchingGenerationIsNotServed,
  assertUnavailableNotificationsKeepThePersistentCache,
};
