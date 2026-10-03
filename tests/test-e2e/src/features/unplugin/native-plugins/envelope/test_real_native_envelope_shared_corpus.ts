import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { hostToolDirectory } from "../../../../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.js";
import { projectRecordFile } from "../../../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { observeReloadEvents } from "../../../../internal/unplugin/internal/adapter-vite-serve/observeReloadEvents";
import type { IRealNativeEnvelopeApi } from "../../../../internal/unplugin/internal/real-native-envelope/IRealNativeEnvelopeApi";
import type { IRealNativeEnvelopeFixture } from "../../../../internal/unplugin/internal/real-native-envelope/IRealNativeEnvelopeFixture";
import { assertProductionEnvelope } from "../../../../internal/unplugin/internal/real-native-envelope/assertProductionEnvelope";
import { createRealNativeEnvelopeFixture } from "../../../../internal/unplugin/internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { deliver } from "../../../../internal/unplugin/internal/real-native-envelope/deliver";
import { loadApi } from "../../../../internal/unplugin/internal/real-native-envelope/loadApi";
import { programRuns } from "../../../../internal/unplugin/internal/real-native-envelope/programRuns";
import { resetRunLog } from "../../../../internal/unplugin/internal/real-native-envelope/resetRunLog";
import { waitFor } from "../../../../internal/unplugin/internal/real-native-envelope/waitFor";
import { cachedGeneration } from "../../../../internal/unplugin/internal/transform-terminal-verdict/cachedGeneration";
import { startFailingCompile } from "../../../../internal/unplugin/internal/transform-terminal-verdict/startFailingCompile";

/**
 * Verifies real native compiler proofs, stabilization and host notifications on
 * one shared resolver corpus and four actual linked contributors.
 *
 * Persistent declaration/candidate phases reuse the initial Program instead of
 * creating another project. Separate build, race, diagnostic, Vite and esbuild
 * cache lifetimes establish their actual ownership boundaries. Every owner
 * closes before the literal authored baseline is restored.
 *
 * 1. Capture one persistent Program and invalidate it by declaration, candidate,
 *    file-kind and automatic-type changes while sibling deliveries reuse it.
 * 2. Check build-scoped reuse, native configuration/declaration races and
 *    diagnostic eviction, replay, replacement and recovery.
 * 3. Exercise Vite invalidation and esbuild watch recovery on that same corpus.
 *
 * Private race, terminal-verdict and esbuild scenarios retain their eight
 * chapter-specific grounds in native prose below. The persistent corpus owns
 * declaration and candidate transitions, assertCoreLifecycle owns build reuse,
 * and assertViteLifecycle owns real graph invalidation. These private owners
 * are reviewable through this entry, not separate Evidence declaration hosts.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual built transform APIs and linked TypeScript-Go contributor produce graphs, count Programs, reject diagnostics and recover; actual Vite and esbuild hosts expose notification and watch-channel consequences. All former six envelope bodies retain their real assertions in this entry or its private scenarios.
 * @evidence contracts/testing.md#independent-expectations Literal Program counts, deliberately changed authored bytes, exact Promise identities, native graph predicates and independently collected host events establish expectations. Returned code alone does not certify host participation, and emitted bundles are not executed.
 * @evidence contracts/testing.md#distinguishing-cases Persistent versus build-scoped reuse, selected declaration and missing/file-kind/type-root mutations, wrapper coherence and concurrent declaration races, diagnostic pass lifetimes, targeted Vite invalidation, and three esbuild recovery histories remain distinct named phases.
 * @evidence contracts/testing.md#execution-ownership This exported E2E entry owns every private scenario and callback. Runner discovery and Evidence select this entry; private scenario chapter prose and anonymous callbacks require manual truth review and have no separately selectable address.
 * @evidence contracts/e2e.md#necessary-boundary Real TypeScript-Go graph and diagnostic envelopes reach built public JS cache APIs and actual Vite/esbuild watcher interfaces. A standalone sidecar cannot establish compiler resolution, diagnostics or real host notification behavior.
 * @evidence contracts/e2e.md#shared-execution One project selects the same ordered banner, paths, strip and Program-probe sources as the utility experiment. Its nonblank banner, configured paths and empty strip lists are supported runtime configuration choices; they do not replace the native registrations. Persistent baseline captures formerly repeated by declaration and candidate entries become one; required invalidation captures remain. Build scope, cache-optional race, retained race, diagnostic verdicts and private adapter caches require their distinct lifetimes. Esbuild cold broken/missing contexts retain their absent successful-history premise.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each lifetime closes its cache/server/context before baseline restoration. Only known scenario-created paths are removed; baseline files are restored byte-for-byte without deleting shared caches. The run log is outside the project and reset between independent lifetimes. TestProject owns temporary directories until runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Declaration, candidate, file-kind and type-root assertions now share persistent counts one through five; unchanged siblings still prove reuse. Build-scoped graph, two real race attempts and stabilized Promise, all terminal verdict identities, Vite quiet/targeted reload and esbuild watch-channel/recovery assertions survive. Independent lifetimes collect failures; failed persistent prerequisites explicitly block their dependent mutations.
 */
export async function test_real_native_envelope_shared_corpus(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture({ resolutionCorpus: true });
  const api = await loadApi();
  const baseline = readBaseline(fixture.root);
  const excludedSource = fixture.excludedSource;
  const failures: Error[] = [];
  const phase = async (
    label: string,
    run: () => Promise<void>,
  ): Promise<boolean> => {
    try {
      await run();
      return true;
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
      return false;
    }
  };
  let baselineAvailable = true;
  const lifetime = async (
    label: string,
    run: () => Promise<void>,
  ): Promise<void> => {
    if (!baselineAvailable) {
      failures.push(
        new Error(`${label}: blocked by baseline restoration failure`),
      );
      return;
    }
    try {
      await phase(label, run);
    } finally {
      // Cache reset schedules disposal behind fulfilled generation Promises.
      // All delivered requests have settled; drain their cleanup microtasks
      // before restoring inputs that their former watchers observed.
      await Promise.resolve();
      baselineAvailable = await phase(
        `${label}: baseline restoration`,
        async () => {
          restoreBaseline(fixture, baseline);
          fixture.excludedSource = excludedSource;
          resetRunLog(fixture.runLog);
        },
      );
    }
  };
  await lifetime("persistent resolver corpus", () =>
    assertPersistentCorpus(api, fixture, phase, failures),
  );
  await lifetime("build-scoped sibling reuse", () =>
    assertCoreLifecycle(api, fixture, true),
  );
  await lifetime("wrapper and concurrent input races", () =>
    test_real_native_envelope_input_race_stabilizes_within_shared_generation(
      fixture,
    ),
  );
  await lifetime("terminal diagnostic verdicts", () =>
    test_real_native_envelope_terminal_verdict_batch(fixture),
  );
  await lifetime("Vite sibling and targeted invalidation", () =>
    assertViteLifecycle(fixture),
  );
  await lifetime("esbuild directory proofs and recovery", () =>
    test_real_native_envelope_esbuild_observes_directories_and_recovers(
      fixture,
    ),
  );
  if (failures.length !== 0)
    throw new AggregateError(failures, "Real native envelope corpus failed");
}

/** Capture the one persistent baseline and retain it through actual mutations. */
async function assertPersistentCorpus(
  api: IRealNativeEnvelopeApi,
  fixture: IRealNativeEnvelopeFixture,
  phase: (label: string, run: () => Promise<void>) => Promise<boolean>,
  failures: Error[],
): Promise<void> {
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    compilerOptions: { strict: true },
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  const steps: Array<[string, () => Promise<void>]> = [
    [
      "persistent sibling baseline",
      async () => {
        await deliver(api, cache, options, fixture.modules[0]!);
        assert.equal(programRuns(fixture.runLog), 1);
        await assertProductionEnvelope(cache, fixture);
        for (const file of fixture.modules.slice(1))
          await deliver(api, cache, options, file);
        assert.equal(
          programRuns(fixture.runLog),
          1,
          "persistent siblings must share one production invocation",
        );
      },
    ],
    [
      "selected declaration replacement",
      async () => {
        fs.writeFileSync(
          fixture.declaration,
          "export interface Shared { label: string; revision?: number; }\n",
          "utf8",
        );
        await deliver(api, cache, options, fixture.modules[1]!);
        assert.equal(
          programRuns(fixture.runLog),
          2,
          "selected declaration edit must replace the generation",
        );
        for (const file of fixture.modules.slice(2))
          await deliver(api, cache, options, file);
        assert.equal(
          programRuns(fixture.runLog),
          2,
          "siblings must reuse the declaration replacement",
        );
      },
    ],
    [
      "superseding candidate replacement",
      async () => {
        fs.writeFileSync(
          fixture.missingCandidate,
          'export const linked = "typescript";\n',
          "utf8",
        );
        await deliver(api, cache, options, fixture.modules[1]!);
        assert.equal(
          programRuns(fixture.runLog),
          3,
          "superseding candidate must replace the generation",
        );
        for (const file of fixture.modules.slice(2, -1))
          await deliver(api, cache, options, file);
        assert.equal(
          programRuns(fixture.runLog),
          3,
          "siblings must reuse the candidate replacement",
        );
      },
    ],
    [
      "directory-to-file replacement",
      async () => {
        fs.rmSync(fixture.fileCandidateDirectory, { recursive: true });
        fs.writeFileSync(
          fixture.fileCandidateDirectory,
          "exports.encode = function encode(value) { return `file:${value}`; };\n",
          "utf8",
        );
        await deliver(api, cache, options, fixture.modules.at(-1)!);
        assert.equal(
          programRuns(fixture.runLog),
          4,
          "directory-to-file candidate must replace the generation",
        );
      },
    ],
    [
      "automatic type-root replacement",
      async () => {
        const generated = path.join(
          fixture.automaticTypesDirectory,
          "generated-ambient",
        );
        fs.mkdirSync(generated, { recursive: true });
        fs.writeFileSync(
          path.join(generated, "index.d.ts"),
          "declare const generatedAmbient: string;\n",
          "utf8",
        );
        await deliver(api, cache, options, fixture.modules[0]!);
        assert.equal(
          programRuns(fixture.runLog),
          5,
          "automatic type package must replace the generation",
        );
      },
    ],
  ];
  let preceding: string | undefined;
  try {
    for (const [label, run] of steps) {
      if (preceding !== undefined)
        failures.push(new Error(`${label}: blocked by ${preceding}`));
      else if (!(await phase(label, run))) preceding = label;
    }
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Save this experiment's authored bytes before any native preparation. */
function readBaseline(root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) files.set(file, fs.readFileSync(file));
    }
  };
  walk(root);
  return files;
}

/** Restore only known mutation inputs after their owning handles have closed. */
function restoreBaseline(
  fixture: IRealNativeEnvelopeFixture,
  baseline: Map<string, Buffer>,
): void {
  const mutations = [
    fixture.missingCandidate,
    path.join(fixture.root, "src", "broken.ts"),
    path.join(fixture.root, "src", "generated-next"),
    path.join(fixture.automaticTypesDirectory, "generated"),
    path.join(fixture.automaticTypesDirectory, "generated-ambient"),
  ];
  for (const file of mutations) {
    if (baseline.has(file)) continue;
    const relative = path.relative(fixture.root, path.resolve(file));
    assert.ok(
      relative !== "" &&
        !relative.startsWith(`..${path.sep}`) &&
        relative !== ".." &&
        !path.isAbsolute(relative),
    );
    fs.rmSync(file, { recursive: true, force: true });
  }
  if (
    fs.existsSync(fixture.fileCandidateDirectory) &&
    fs.statSync(fixture.fileCandidateDirectory).isFile()
  )
    fs.unlinkSync(fixture.fileCandidateDirectory);
  for (const [file, bytes] of baseline) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
}

/** Drive one core cache lifecycle and assert its real envelope before reuse. */
async function assertCoreLifecycle(
  api: IRealNativeEnvelopeApi,
  fixture: IRealNativeEnvelopeFixture,
  buildScoped: boolean,
  compilerOptions?: Record<string, unknown>,
): Promise<void> {
  const cache = api.createTtscTransformCache();
  if (buildScoped) api.beginTtscTransformBuild(cache);
  const options = api.resolveOptions({
    ...(compilerOptions === undefined ? {} : { compilerOptions }),
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
  const declaration = fs.readFileSync(fixture.declaration, "utf8");
  const runtimeFile = path.join(path.dirname(fixture.declaration), "index.js");
  const runtime = fs.readFileSync(runtimeFile, "utf8");
  fs.unlinkSync(fixture.declaration);
  fs.unlinkSync(runtimeFile);
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    resolve: {
      alias: {
        "@fixture/value": path.join(viteRoot, "paths", "value.js"),
        "./rooted.js": path.join(viteRoot, "generated", "rooted.js"),
      },
    },
    root: viteRoot,
    server: { host: "127.0.0.1", port: 0 },
  });
  try {
    await server.listen();
    const events = await observeReloadEvents(server);
    await assert.rejects(server.transformRequest("/src/mod0.ts"), /typed-dep/);
    fs.writeFileSync(fixture.declaration, declaration);
    fs.writeFileSync(runtimeFile, runtime);
    await waitFor(
      () => events.length !== 0,
      "initially missing native dependency recovery before refetch",
    );
    events.length = 0;
    const graph =
      server.environments?.client?.moduleGraph ?? server.moduleGraph;
    const entries: Array<{ file: string; node: any }> = [];
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
      entries.push({ file, node });
    }
    assert.equal(
      programRuns(fixture.runLog),
      1,
      "the Vite serve lifecycle must share one production host invocation across sibling modules",
    );

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    assert.ok(
      entries.every(
        ({ node }) =>
          node.transformResult !== null && node.transformResult !== undefined,
      ),
      "several unchanged polls must preserve every cached transform",
    );
    assert.equal(
      events.length,
      0,
      "an extension-shaped directory must not be mistaken for an appearing file",
    );

    // Vite can transpile TypeScript even if the ttsc adapter bypasses a module,
    // so returned code alone does not prove the request crossed our transform
    // hook. Replace the exact failed file predicate with a selectable file and
    // require the adapter's private poll to invalidate its importer.
    const predicate = entries.find(({ file }) =>
      file.endsWith("predicate.cts"),
    );
    assert.ok(predicate, "the Vite graph must contain the predicate importer");
    const unrelated = entries.filter((entry) => entry !== predicate);
    fs.rmSync(fixture.fileCandidateDirectory, { recursive: true });
    fs.writeFileSync(
      fixture.fileCandidateDirectory,
      "exports.encode = function encode(value) { return `file:${value}`; };\n",
      "utf8",
    );
    await waitFor(
      () =>
        predicate.node.transformResult === null ||
        predicate.node.transformResult === undefined,
      "the predicate importer to be invalidated after its directory became a file",
    );
    assert.ok(
      unrelated.every(
        ({ node }) =>
          node.transformResult !== null && node.transformResult !== undefined,
      ),
      "the file predicate must invalidate only importers that own it",
    );
    await waitFor(
      () => events.length !== 0,
      "the HMR client to receive a reload",
    );
    assert.ok(
      events.some((event) => event.type === "full-reload"),
      "the directory-to-file transition must announce a full reload",
    );
    assert.equal(
      programRuns(fixture.runLog),
      1,
      "candidate notification must invalidate the importer without compiling until Vite requests it again",
    );
  } finally {
    await server.close();
  }
}

/**
 * Verifies wrapper-state and compiler-input races stabilize within bounded
 * attempts and one shared generation.
 *
 * A config inherited by the generated wrapper can change after the wrapper is
 * written, and a compiler input can change between attempts. A delivery must
 * discard the mixed wrapper state and retry once, and concurrent modules must
 * share that failed attempt and its stable retry rather than each starting
 * their own.
 *
 * 1. Race a replacement of the inherited config after wrapper materialization, and
 *    an input change across attempts.
 * 2. Assert a delivery discards the mixed state and retries once.
 * 3. Deliver modules concurrently and assert they share the failed attempt and the
 *    stable retry, and later modules reuse that generation.
 *
 * Behavioral verification: transformTtsc discards an inherited-config race
 * after wrapper materialization, produces output in two attempts, then
 * concurrent modules share a declaration race and its stable retry. Assertions
 * require both mutations to occur, two invocation-log bytes, complete snapshot,
 * one cache entry, and the same stable Promise on later deliveries. Independent
 * expectations: The actual contributor changes inherited config and declaration
 * inputs during ApplyProgram, after wrapper materialization and before
 * post-compile coherence admission. Literal attempt counts and stable Promise
 * identity require a coherent replacement without deriving expected values from
 * cache validation. assertProductionEnvelope calibrates against actual native
 * graph fields; output type semantics are outside this race oracle.
 * Distinguishing cases: The first phase has no supplied cache and races an
 * inherited config after wrapper creation. The second resets the contributor
 * attempt marker and run log, races a declaration under concurrent cached
 * requests, then checks unchanged sequential deliveries reuse that stabilized
 * generation. Execution ownership: The shared native corpus entry owns this
 * private scenario and both concurrent callback phases; the scenario has its
 * own failure label but no separately selectable Evidence address. Necessary
 * boundary: The generated wrapper, real compiler's input capture and native
 * ApplyProgram hook meet the JS concurrent cache. This detects a mixed wrapper
 * or compile snapshot that an isolated validator receiving a finished synthetic
 * envelope cannot expose. Shared execution: Both phases use one real fixture
 * and shared contributor artifact. The cache-optional and cached phases require
 * separate captures because they test different ownership paths; within the
 * cached phase all modules share one failed attempt and one retry. Later
 * modules reuse the completed generation without native work. State isolation
 * and reuse validity: No foreign filesystem operation is replaced; the
 * contributor config selects the first config mutation and the second
 * declaration mutation. Resetting raceAttempt and runLog creates a fresh actual
 * race despite shared contributor code; the experiment restores common baseline
 * bytes after the owned cache closes. The cache is reset in finally, and
 * TestProject owns directories through runner exit. Preserved coverage: The
 * inherited-config mutation within the wrapper coherence window, two-attempt
 * counts, declaration revision, complete snapshot, real envelope and
 * stable-generation identity assertions all remain in this entry. No coverage
 * is transferred; concurrency and the cache-optional connection both remain
 * actual native executions.
 */
async function test_real_native_envelope_input_race_stabilizes_within_shared_generation(
  fixture: IRealNativeEnvelopeFixture,
): Promise<void> {
  const api = await loadApi();
  const options = api.resolveOptions({
    compilerOptions: { strict: true },
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  const leafConfig = path.join(fixture.root, "tsconfig.json");
  const baseConfig = path.join(fixture.root, "presets", "base.json");
  const nextExcluded = path.join(
    fixture.root,
    "src",
    "generated-next",
    "ignored.ts",
  );
  fs.mkdirSync(path.dirname(nextExcluded), { recursive: true });
  fs.copyFileSync(fixture.excludedSource, nextExcluded);
  fixture.excludedSource = nextExcluded;
  const racedConfig = JSON.stringify({
    compilerOptions: {
      outDir: "${configDir}\\src\\generated-next",
      rootDir: "${configDir}",
    },
  });
  const initial = JSON.parse(fs.readFileSync(leafConfig, "utf8"));
  const initialProbe = initial.compilerOptions.plugins.find(
    (entry: { transform?: string }) => entry.transform === "./plugin.cjs",
  );
  assert.ok(initialProbe, "the manifest must retain the actual Program probe");
  Object.assign(initialProbe, {
    raceAttempt: 0,
    raceFile: baseConfig,
    raceContent: racedConfig,
  });
  fs.writeFileSync(leafConfig, JSON.stringify(initial, null, 2), "utf8");
  const raceFailures: Error[] = [];
  try {
    assert.ok(
      await api.transformTtsc(
        fixture.modules[0]!,
        fs.readFileSync(fixture.modules[0]!, "utf8"),
        options,
        undefined,
        undefined,
      ),
    );
    assert.equal(
      fs.readFileSync(baseConfig, "utf8"),
      racedConfig,
      "the contributor must replace inherited config after wrapper materialization",
    );
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "a cache-optional delivery must discard the mixed wrapper state and retry once",
    );
  } catch (error) {
    raceFailures.push(
      new Error("cache-optional inherited-config race", { cause: error }),
    );
  }
  // The retained-cache declaration race has an independent baseline even when
  // an assertion above failed. Restore its known config state explicitly.
  fs.writeFileSync(baseConfig, racedConfig, "utf8");

  const parsed = JSON.parse(fs.readFileSync(leafConfig, "utf8")) as {
    compilerOptions: { plugins: Array<Record<string, unknown>> };
  };
  const retainedProbe = parsed.compilerOptions.plugins.find(
    (entry) => entry.transform === "./plugin.cjs",
  );
  assert.ok(
    retainedProbe,
    "the retained race must configure the actual Program probe",
  );
  Object.assign(retainedProbe, {
    raceAttempt: 0,
    raceFile: fixture.declaration,
    raceContent:
      "export interface Shared { label: string; revision?: number; }\n",
  });
  fs.writeFileSync(leafConfig, JSON.stringify(parsed, null, 2), "utf8");
  resetRunLog(fixture.runLog);

  const cache = api.createTtscTransformCache();
  try {
    const deliveries = await Promise.allSettled(
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
    const rejected = deliveries.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (rejected.length !== 0) {
      throw new AggregateError(
        rejected.map((result) => result.reason),
        "concurrent native deliveries failed",
      );
    }
    assert.equal(
      programRuns(fixture.runLog),
      2,
      "concurrent modules must share the failed declaration attempt and its stable retry",
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
  } catch (error) {
    raceFailures.push(
      new Error("concurrent declaration race", { cause: error }),
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
  if (raceFailures.length !== 0)
    throw new AggregateError(raceFailures, "Native input race phases failed");
}

/**
 * Verifies native diagnostic verdicts across persistent and delivery-pass
 * lifetimes.
 *
 * Four linked native contributors and one broken program distinguish no-pass
 * eviction, same-pass replay, next-pass retry and corrected-project recovery.
 * Repeating the initial failing capture in three independent projects added no
 * boundary; the already retained verdict supplies the next positive scenario's
 * baseline.
 *
 * 1. Deliver two modules without a pass and assert failure is evicted each time.
 * 2. Open a pass and assert every remaining module replays its one verdict.
 * 3. Open another pass and assert a new verdict then replay across modules.
 * 4. Fix the type error, open a new pass and assert actual transformed output.
 *
 * Behavioral verification: Actual built public adapter and linked native
 * compiler diagnose the broken program, evict without a pass, replay one exact
 * Promise within a pass, replace it on a new pass and transform after a real
 * source correction. Independent expectations: Literal number-versus-string
 * source and assignability diagnostic, zero cache sizes and exact
 * same/different Promise identities specify the independent lifetime oracle;
 * corrected numeric source must actually return transformed output.
 * Distinguishing cases: Persistent no-pass eviction contrasts with per-pass
 * retention; sibling modules repeat the same verdict, a new pass repeats
 * capture with a different Promise, and changed source recovers on the next
 * pass. Execution ownership: The private terminal-verdict scenario in the
 * shared corpus owns all four former terminal-verdict entries and their
 * original assertions; each phase records its failure identity and later
 * independent phases still execute. The real Go contributor and compiler are
 * retained because their diagnostic envelope is the boundary under test.
 * Necessary boundary: A native linked contributor shares the compiler's actual
 * program and returns structured diagnostic failure; the executable sidecar
 * fixture cannot stand in because it does not type-check. Real successful
 * recovery confirms the changed source reaches that same connection. Shared
 * execution: The common experiment fixture root and contributor are reused; one
 * local options/cache pair serves the diagnostic phases. The no-pass negative
 * requires two actual attempts, two failed pass captures establish different
 * verdicts, and one corrected capture establishes recovery; repeated initial
 * seeds are replaced by actual retained verdicts. State isolation and reuse
 * validity: The broken source and options remain fixed until the recovery
 * phase; reset after the no-pass phase clears any failed residual state before
 * opening a pass. Positive phases intentionally share the exact retained
 * verdict; only explicit new-pass boundaries request another capture, and
 * finally releases the cache after success or failure. Preserved coverage:
 * Every original rejection, cache-empty, exact cached-Promise
 * replay/replacement and recovered-result assertion remains in its
 * corresponding phase. No-pass behavior stays actual E2E, and phase errors are
 * aggregated rather than allowing the first assertion failure to hide later
 * independent cases.
 */
async function test_real_native_envelope_terminal_verdict_batch(
  fixture: IRealNativeEnvelopeFixture,
): Promise<void> {
  const { api, brokenFile, cache, deliver, modules } =
    await startFailingCompile(true, fixture);
  const failures: Error[] = [];
  const phase = async (
    label: string,
    run: () => Promise<void>,
  ): Promise<void> => {
    try {
      await run();
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };
  try {
    await phase("no-pass eviction", async () => {
      try {
        await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
        assert.equal(
          cache.size,
          0,
          "without a delivery pass a failed compile must not stay cached",
        );
        await assert.rejects(() => deliver(modules[1]!), /is not assignable/);
        assert.equal(cache.size, 0);
      } finally {
        api.resetTtscTransformCache(cache);
      }
    });
    await phase("same-pass replay", async () => {
      api.beginTtscTransformBuild(cache);
      await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
      const verdict = cachedGeneration(cache);

      for (const file of modules.slice(1)) {
        await assert.rejects(() => deliver(file), /is not assignable/);
        assert.equal(
          cachedGeneration(cache),
          verdict,
          `delivering ${path.basename(file)} must replay the pass verdict rather than start a second compile`,
        );
      }
    });
    await phase("next-pass replacement", async () => {
      await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
      const first = cachedGeneration(cache);

      api.beginTtscTransformBuild(cache);
      await assert.rejects(() => deliver(modules[0]!), /is not assignable/);
      const second = cachedGeneration(cache);
      assert.notEqual(
        second,
        first,
        "a new pass must attempt the compile again rather than replay the previous pass's verdict",
      );

      for (const file of modules.slice(1)) {
        await assert.rejects(() => deliver(file), /is not assignable/);
        assert.equal(
          cachedGeneration(cache),
          second,
          "the rest of the second pass must replay that pass's own verdict",
        );
      }
    });
    await phase("corrected next-pass recovery", async () => {
      await assert.rejects(() => deliver(modules[0]!), /is not assignable/);

      fs.writeFileSync(
        brokenFile,
        "export const broken: number = 1;\n",
        "utf8",
      );
      api.beginTtscTransformBuild(cache);
      const recovered = await deliver(modules[0]!);
      assert.ok(recovered, "the corrected project must transform");
    });
    if (failures.length !== 0) {
      throw new AggregateError(
        failures,
        "Native terminal verdict batch failed",
      );
    }
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/**
 * Verifies an esbuild context rebuilds for real compiler directory proofs and
 * recovers from failed loads.
 *
 * Esbuild's own `watchFiles` cannot observe directory membership, so a type
 * package appearing or vanishing reaches it only through the project's record,
 * which the adapter's observer moves; a failed load must name the record too,
 * so a repair reaches the same context without manual invalidation.
 *
 * One esbuild build keeps one watch state per path, taken from the last loader
 * result that named it, so a later module's result masks an earlier module's
 * edit, and a file read of an absent path overwrites its directory read. No
 * compiler dependency is therefore handed to esbuild by the adapter: each goes
 * to the bridge, and the adapter reports only the module and project's record
 * (samchon/ttsc#1463). Esbuild may separately watch the runtime JavaScript
 * dependencies it resolves from this larger corpus.
 *
 * The larger corpus retains paths and rootDirs imports. Vite uses its public
 * alias configuration and esbuild uses its public onResolve hook for the
 * virtual rootDirs runtime import. These are test-host configurations; this
 * scenario does not claim esbuild implements native rootDirs resolution.
 *
 * 1. Add and remove automatic type packages and their parent directory, asserting
 *    every build hands esbuild nothing but each module and the record.
 * 2. Check shared compilation and reuse across an unchanged rebuild.
 * 3. Recover from deleted, initially broken, and initially absent declarations.
 *
 * Behavioral verification: Actual esbuild watch contexts rebuild after
 * automatic type-package and parent-directory changes, reuse an unchanged
 * rebuild, and recover after deleted, syntactically broken and initially absent
 * dependencies. Traced loader results must expose only modules and the project
 * record, with no path in both watch channels; each expected result also checks
 * error status. Independent expectations: Type-root membership and package
 * resolution require new native Programs, while unchanged explicit rebuild
 * requires none. Literal invocation counts, deliberate source deletion and
 * malformed declaration, and independently collected esbuild errors/watch
 * channels establish the oracle. The test does not execute emitted bundles.
 * Distinguishing cases: Add/remove a type package, remove/recreate its parent,
 * unchanged rebuild, successful history followed by dependency deletion, and
 * cold broken or missing dependencies exercise different recovery baselines.
 * Removing both declaration and JS fallback prevents legitimate untyped
 * fallback from masking the missing-input branch. Execution ownership: The
 * shared native corpus entry executes this private esbuild scenario with a
 * distinct failure label; Evidence cannot separately address this private
 * declaration. Its start/nextResult/observe closures own every watch transition
 * and retain the count and error checks; waiting times bound actual
 * asynchronous host completion rather than create separate test identities.
 * Necessary boundary: Real native directory and failure proofs reach an actual
 * esbuild watcher through the adapter's project record. Synthetic hook calls
 * cannot show that esbuild observes changes, avoids colliding directory/file
 * watch channels, or recovers without manually invalidating its context. Shared
 * execution: One esbuild context batches all successful-history mutations and
 * the unchanged rebuild over four entry modules sharing a Program. A new
 * context is necessary for each initially broken and initially absent baseline,
 * because prior successful watch history would invalidate that distinction. All
 * contexts reuse the same fixture, shared contributor and native build cache.
 * State isolation and reuse validity: channels clear at each onStart and result
 * arrays reset when cold contexts replace disposed contexts. The original
 * declaration and JS fallback are saved and restored together; the experiment
 * restores the common baseline after all contexts close. Every replaced context
 * is disposed and the active one is disposed in finally; TestProject owns
 * temporary roots until runner cleanup. Preserved coverage: Invocation counts,
 * unchanged rebuild reuse, every expected success/failure result, exact
 * watch-channel restriction and all three dependency recovery baselines remain
 * executable here. No portable assertion is removed or transferred; this entry
 * retains the real esbuild notification connection.
 */
async function test_real_native_envelope_esbuild_observes_directories_and_recovers(
  fixture: IRealNativeEnvelopeFixture,
): Promise<void> {
  const esbuild = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("esbuild");
  const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("esbuild");
  const root = fs.realpathSync.native(fixture.root);
  const options = { project: path.join(root, "tsconfig.json") };
  const results: Array<{ errors: unknown[] }> = [];
  let starts = 0;
  // Every path the adapter's results handed each channel in the current build.
  const channels = new Map<string, "watchDirs" | "watchFiles">();
  const collisions: string[] = [];
  const traced = (plugin: any) => ({
    ...plugin,
    setup: (build: any) =>
      plugin.setup(
        new Proxy(build, {
          get(target, key) {
            const value = Reflect.get(target, key);
            if (key !== "onLoad")
              return typeof value === "function" ? value.bind(target) : value;
            return (filter: object, load: (args: object) => Promise<any>) =>
              value.call(target, filter, async (args: object) => {
                const result = await load(args);
                for (const channel of ["watchDirs", "watchFiles"] as const)
                  for (const file of result?.[channel] ?? []) {
                    if ((channels.get(file) ?? channel) !== channel)
                      collisions.push(file);
                    channels.set(file, channel);
                  }
                return result;
              });
          },
        }),
      ),
  });
  const start = () =>
    esbuild.context({
      absWorkingDir: root,
      entryPoints: fixture.modules.slice(0, 4),
      outdir: path.join(root, "dist-esbuild"),
      bundle: true,
      write: false,
      logLevel: "silent",
      plugins: [
        traced(adapter(options)),
        {
          // esbuild does not implement TypeScript rootDirs virtual lookup.
          // Its supported resolver hook maps this corpus's virtual import to
          // the same authored runtime input selected by the native compiler.
          name: "real-envelope-rootdirs",
          setup(build: any) {
            build.onResolve({ filter: /^\.\/rooted\.js$/ }, () => ({
              path: path.join(root, "generated", "rooted.js"),
            }));
          },
        },
        {
          name: "observe-native-esbuild",
          setup(build: any) {
            build.onStart(() => {
              starts += 1;
              channels.clear();
            });
            build.onEnd((result: { errors: unknown[] }) => {
              results.push(result);
            });
          },
        },
      ],
    });
  const nextResult = async (
    count: number,
    failed = false,
    expectedDiagnostic = "Cannot find module 'typed-dep' or its corresponding type declarations.",
  ) => {
    // The first event can build the shared native host on a cold cache. Later
    // events must arrive promptly; no fixed delay is paid on either path.
    // A timeout names which side stalled: a build esbuild never started, one
    // that started and never ended, or a recompile still running.
    await waitFor(
      () => results.length >= count,
      "esbuild watch result",
      count === 1 ? 240_000 : 20_000,
    ).catch((error: Error) => {
      throw new Error(
        `${error.message} ${count}: ${starts} build(s) started, ${results.length} ended, ${programRuns(fixture.runLog)} compile(s)`,
      );
    });
    assert.equal(results[count - 1]!.errors.length !== 0, failed);
    if (failed)
      assert.ok(
        results[count - 1]!.errors.every((error) => {
          if (typeof error !== "object" || error === null) return false;
          if (!("detail" in error) || !(error.detail instanceof Error))
            return false;
          if (error.detail.name !== "TtscCompileFailureError") return false;
          const sourceAddress =
            expectedDiagnostic === "'}' expected."
              ? /(?:^|\/)typed-dep\/dist\/index\.d\.ts$/
              : /(?:^|\/)src\/mod[0-3]\.ts$/;
          return error.detail.message
            .replaceAll("\\", "/")
            .split(/\r?\n/)
            .some((line) => {
              const diagnostic = /^(.+?):\s*\d+:\d+:\s*(.*)$/.exec(line);
              return (
                diagnostic !== null &&
                sourceAddress.test(diagnostic[1]!) &&
                diagnostic[2]!.trim() === expectedDiagnostic
              );
            });
        }),
        `Expected a native compiler diagnostic ${expectedDiagnostic}; unrelated esbuild resolver failures cannot prove this negative phase`,
      );
    assert.deepEqual(collisions, [], "a path reached both watch channels");
    assert.deepEqual(
      [...channels.keys()].filter(
        (file) =>
          path.resolve(file) !==
            projectRecordFile(hostToolDirectory(root), options.project) &&
          !(
            /\.[cm]?tsx?$/.test(file) &&
            !file.endsWith(".d.ts") &&
            !file.includes("node_modules")
          ),
      ),
      [],
      "esbuild is handed nothing but each module and the record",
    );
  };
  const observe = async (change: () => void, failed = false) => {
    const count = results.length + 1;
    change();
    await nextResult(count, failed);
  };
  const declaration = fs.readFileSync(fixture.declaration, "utf8");
  const runtimeFile = path.join(path.dirname(fixture.declaration), "index.js");
  const runtime = fs.readFileSync(runtimeFile, "utf8");
  const failures: Error[] = [];
  const history = async (
    label: string,
    run: (context: any) => Promise<void>,
  ): Promise<void> => {
    results.length = 0;
    const context = await start();
    try {
      await run(context);
    } catch (error) {
      failures.push(new Error(label, { cause: error }));
    } finally {
      await context.dispose();
    }
  };
  await history(
    "successful-history membership and deletion recovery",
    async (context) => {
      await context.watch();
      await nextResult(1);
      assert.equal(programRuns(fixture.runLog), 1);
      const generated = path.join(fixture.automaticTypesDirectory, "generated");
      fs.mkdirSync(generated);
      fs.writeFileSync(
        path.join(generated, "index.d.ts"),
        "declare const generatedGlobal: string;\n",
      );
      await nextResult(2);
      assert.equal(programRuns(fixture.runLog), 2);
      fs.rmSync(generated, { recursive: true });
      await nextResult(3);
      assert.equal(programRuns(fixture.runLog), 3);
      await context.rebuild();
      assert.equal(programRuns(fixture.runLog), 3);
      await observe(() =>
        fs.rmSync(fixture.automaticTypesDirectory, { recursive: true }),
      );
      assert.equal(programRuns(fixture.runLog), 4);
      await observe(() => {
        fs.mkdirSync(generated, { recursive: true });
        fs.writeFileSync(
          path.join(generated, "index.d.ts"),
          "declare const generatedGlobal: string;\n",
        );
      });
      assert.equal(programRuns(fixture.runLog), 5);

      // Remove the runtime fallback too: this fixture permits untyped JS, so
      // deleting only the declaration legitimately resolves to index.js.
      await observe(() => {
        fs.unlinkSync(fixture.declaration);
        fs.unlinkSync(runtimeFile);
      }, true);
      await observe(() => {
        fs.writeFileSync(fixture.declaration, declaration);
        fs.writeFileSync(runtimeFile, runtime);
      });
    },
  );
  fs.mkdirSync(path.dirname(fixture.declaration), { recursive: true });
  fs.writeFileSync(fixture.declaration, declaration);
  fs.writeFileSync(runtimeFile, runtime);

  // Cold syntax and absent-dependency histories cannot inherit a successful
  // watch result; each retains a necessary real context lifetime on this root.
  fs.writeFileSync(fixture.declaration, "export interface Shared {\n");
  await history("initially broken declaration recovery", async (context) => {
    await context.watch();
    await nextResult(1, true, "'}' expected.");
    fs.writeFileSync(fixture.declaration, declaration);
    await nextResult(2);
  });
  fs.unlinkSync(fixture.declaration);
  fs.unlinkSync(runtimeFile);
  await history("initially absent dependency recovery", async (context) => {
    await context.watch();
    await nextResult(1, true);
    fs.writeFileSync(fixture.declaration, declaration);
    fs.writeFileSync(runtimeFile, runtime);
    await nextResult(2);
  });
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "esbuild native recovery histories failed",
    );
}
