import {
  FileSystemIterator,
  TestProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

import { SidecarEnvironment } from "../../../../packages/ttsc/lib/compiler/internal/sharedHost/SidecarEnvironment";
import { TtscCompiler } from "../../../../packages/ttsc/lib/index";
import { RuntimeLoaderCapabilities } from "../../../../packages/ttsc/lib/launcher/internal/runtime/RuntimeLoaderCapabilities";
import { CapabilityResolutionFormat } from "../../../../packages/ttsc/lib/plugin/internal/CapabilityResolutionFormat";
import { loadProjectPlugins } from "../../../../packages/ttsc/lib/plugin/internal/load/loadProjectPlugins";
import { pluginModuleReplaceDirectories } from "../../../../packages/ttsc/lib/plugin/internal/source/pluginModuleReplaceDirectories";
import { pluginSourceState } from "../../../../packages/ttsc/lib/plugin/internal/source/pluginSourceState";
import { prunesPluginSourceDirectory } from "../../../../packages/ttsc/lib/plugin/internal/source/prunesPluginSourceDirectory";
import { resolveGoCompiler } from "../../../../packages/ttsc/lib/plugin/internal/source/resolveGoCompiler";
import { spawnGoTool as actualSpawnGoTool } from "../../../../packages/ttsc/lib/plugin/internal/source/spawnGoTool";
import {
  resolveCapabilityPluginResolution,
  resolveCapabilityPlugins,
} from "../../../../packages/ttsc/lib/plugin/resolveCapabilityPlugins";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import {
  type LoaderPoolOutcome,
  createLoaderPoolWorker,
} from "../batch/LoaderPoolWorker";
import { observePluginLockGraph } from "../batch/PluginLockGraph";
import { deadCompilerClaimCorpus } from "../batch/deadCompilerClaimCorpus";
import {
  buildSourcePlugin,
  computeCacheKey,
  createFakeGoBinary,
  ensureExecutableGoToolchain,
} from "../internal/ttsc/internal/source-build";
import { waitFor } from "../internal/unplugin/internal/adapter-vite-serve/waitFor";
import { originalPositionFor } from "../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../internal/unplugin/internal/source-map/positionOf";

/**
 * Delivers distinct modules through one shared native loader pool.
 *
 * The Metro worker requires the actual CJS config and the transformer path it
 * returns before its first existing delivery. That delivery's authored upstream
 * also returns one identifier location from transformed text; the parent checks
 * the banner shift and the adapter's restoration against the original source.
 * Before admission, that same caller evaluates the descriptor failure and
 * runtime-input population. One source graph retains extension substitution,
 * package search, config absence and evaluation-time config appearance without
 * creating another worker or authored Go input. Native dependency completeness
 * is conservative across all linked contributors. Paths does not report
 * completeness, so this envelope must omit the whole-file certificate despite
 * the fixture's explicit reports. Actual transformed source membership and
 * record inputs remain separate transport assertions; the direct
 * notifyWatchInputs unit owns complete/unmarked selection in one envelope. The
 * same descriptor command advances one lint config graph through MJS helper and
 * typed-helper edits, a typed namespace collision and a thrown config, then
 * reads its logging JSON contributor. Six actual factory calls replace eight
 * former calls and three outer capture processes. Their real
 * evaluator/checked-load costs remain; no worker or request is added. Exact
 * contributor arrays cross the strict JSON reply channel and joined stderr owns
 * success/failure logs, with source/environment restoration before native
 * adapter admission. CLI termination is not inferred from these caught errors.
 * The existing Metro caller also owns one fresh outside-walk graph-proof
 * publication namespace. Its first external declaration proof sees different
 * bytes from the actual native compiler; a successful retry must have two real
 * ApplyProgram receipts. These precede, and do not satisfy, the separate
 * initial one-Program sharing assertion. No additional Node worker is started.
 * Cache withdrawal schedules disposal; the worker close is joined separately.
 * An independent tracked observation directory carries the real native
 * command/key/terminal receipts and the inherited cache selection. Successful
 * traces remain exit-owned; failed traces transfer to the reporting caller
 * before that cleanup. When the runner configures an observation sink, this
 * allocation is its child so the artifact owner can collect the native
 * receipts. It retains no copied fixture or Go cache. Retention failure
 * accompanies the original error rather than replacing it. Descriptor and
 * capability reuse additionally require the selected Node evaluator's actual
 * public resolve-hook capability, independently probed by the existing
 * recorder. Supported observation retains exact cache-hit and publication
 * assertions. Missing capability instead requires fresh factory calls, explicit
 * incomplete proof and no reusable answer publication. Default maintenance
 * borrows one upfront normal package outside prior cache consumers; neither
 * runtime versions nor operating-system names select these assertions.
 *
 * @evidence contracts/testing.md#behavioral-verification Metro forwards transformed source and original arguments; Turbopack completes once with executable source, linked-host printed TypeScript, its owned authored map and dependency records. Initial native admission requires one actual ApplyProgram receipt across the two workers while that hook writes an independently authored non-input log, whose bytes must appear without joining the declared record. The nested relative banner configFile must produce its own text and exclude the discovered root decoy; later edits to that exact nested file must replace the native publication.
 * @evidence contracts/testing.md#independent-expectations Independently authored source coordinates, map provenance, marker, caller arguments and native ApplyProgram log distinguish delivery and shared compilation independently of adapter counters. The actual resident Program's case-policy receipt supplies an independent reference for two Node cache-root proxy queries; both roots are assumed to have the selected fixture's comparison policy, without certifying arbitrary volumes or executables.
 * @evidence contracts/testing.md#distinguishing-cases Two resident processes request different modules through different built adapters, then observe failure/replay/repair under the same options/session; real publication identities distinguish reuse from another compile. The original native compile-count assertion is limited to initial pool admission, before the explicit declaration/candidate/membership transitions. Ignored hashed output creation contrasts with three delete/recreate transitions of an owned directory below the configured outDir, followed by retained publication and unchanged ApplyProgram receipt.
 * @evidence contracts/testing.md#execution-ownership One pool starts two resident workers, the existing Turbopack owner in development mode with its real default bridge, each observing normal/failure/replay/repair and changed-external/replay states with simultaneous unrelated candidate-directory and ignored hashed-output churn. The existing external-config epoch also changes both delivered source files while its two requests carry their original stale bytes; actual native source and executable value must follow disk. Later deliveries retain that publication despite divergent host text, and joined real stderr must contain one divergent-source warning per resident. The first Metro response additionally forwards one excluded source unchanged; later commands do not repeat that control. This is seventeen planned adapter transforms within sixteen worker commands. No request creates another worker, host, project or configuration profile; initial native producer receipt and later publication identities are asserted separately.
 * @evidence contracts/e2e.md#necessary-boundary Built loaders, inherited session and real producer cross process boundaries. The existing Metro worker now exercises CJS withTtsc and requires its actual returned transformer, executes getCacheKey and retains a native-banner-shifted upstream AST identifier whose start/end must return to independently authored source coordinates. This is not a running Next or Metro server; key shape is not proof of a productive snapshot.
 * @evidence contracts/e2e.md#shared-execution Upfront public prepare requests share the owned native source with two instance cache namespaces; plugin/Go cache admission and source/environment edits then exercise that same producer before adapter startup. These are actual build/key/native-transform phases of this experiment, not a single Program assertion or per-original fixture loop. The Metro Node caller advances one descriptor scope through nine failure inputs before its adapter admission, with real evaluator attempts and no extra worker. The pool borrows one prepared population. Metro explicitly selects its root project; Turbopack discovers the nested files-empty solution and selects that same root through its reference. Both requests must still share one initial native admission. No worker creates a project or a per-case producer. The existing six adapter roots and skipLibCheck=false policy are established before the first graph-proof request; imported dependencies and the later membership root remain selected, while runtime-only roots keep their separate runtime owner. This moves the existing config write without adding a request, producer, Program or warmup.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Environment copies and a fresh session isolate the pool. Both cache-root queries use the actual platform before native admission, so their directory creation cannot introduce an extra input epoch; the selected Program independently reports that same native comparison policy. Source/config bytes and both authored churn files are restored before close; the initially absent output recreation subtree is owned exclusively and removed. The capture-time producer configuration and its initially absent log are restored only after both workers join. Actual close is joined; missed deadlines reject as unresolved ownership and retain inputs. The independent observation allocation is retained on every propagated pool failure, including setup or cleanup failure, with its path reported. Its identity-checked retention and any failure remain separate from native result acceptance; a successful whole pool leaves trace reclamation to the tracked exit owner.
 * @evidence contracts/e2e.md#preserved-coverage Metro forwarding and Turbopack source/authored-map/dependency delivery retain the two-worker single-compile distinction. Adds actual shared failed publication/replay/repair and relative nested configFile selection over a discovered-root decoy while preserving initial arguments/authored-map/dependency delivery; The existing Turbopack watching worker additionally owns real declaration signal/repeat/acknowledgment, ignored package bytes, preferred candidate appearance, source membership and persistent record after joined close. Additional native recompilation and predicate revalidation are state costs of this same pool, not claimed as one total Program. A genuinely fresh Metro worker after both old workers close must deliver an offline-edited marker and one new real probe tick without deleting retained publications; it adds one Node worker and necessary native preparation. The same public entry independently collects deadCompilerClaimCorpus on one upfront native producer project: an actual PID-owned holder lock/native receipt precedes holder death, then a survivor must produce PROBED with a second native receipt and remove the lock. Two additional Node workers and three actual native producer invocations are costs; the survivor owns two completed five-second native holds, each with unchanged temporary environment and sub-750ms initial/intertick/terminal gaps. The resident graph startup receipt remains separate from that strict native boundary; recorded native departure is separately acquired and native preparation totals remain unmeasured. The timed holder joins before the resident pool starts, so synchronous descriptor and metadata operations cannot starve its in-flight lock polling. Both independent failures are collected; an unresolved holder retains the workspace and refuses subsequent shared reuse. A live external bundler watcher remains unproved.
 */
export async function test_e2e_metro_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const failures: unknown[] = [];
  // The timed holder's lock must be observed while its native call is in flight.
  // The resident pool also performs synchronous descriptor and Go metadata
  // operations, which can prevent this parent's polling from running at all.
  // Collect both owners, but join the timed owner before starting that work.
  for (const operation of [
    () => deadCompilerClaimCorpus(workspace),
    runResidentLoaderPool,
  ]) {
    try {
      await operation();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "resident loader pool and actual dead claim",
    );
}

async function runResidentLoaderPool(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const lib = path.join(TestProject.WORKSPACE_ROOT, "packages/metro/lib");
  let baseline = fs.existsSync(workspace.programRunLog)
    ? fs.statSync(workspace.programRunLog).size
    : 0;
  let receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
  let caseOffset = fs.existsSync(workspace.casePolicyReceipt)
    ? fs
        .readFileSync(workspace.casePolicyReceipt, "utf8")
        .split(/\r?\n/)
        .filter(Boolean).length
    : 0;
  const session = path.join(workspace.root, "loader-pool-session");
  assert.equal(
    fs.existsSync(session),
    false,
    "the pool owns a fresh shared session directory",
  );
  fs.mkdirSync(session);
  assert.equal(
    fs.statSync(session).isDirectory(),
    true,
    "both workers inherit an admitted shared session before starting",
  );
  // The observation allocation owns only this invocation's trace files. It
  // cannot inherit the shared Go/plugin cache's unconditional exit cleanup.
  const configuredTraceRoot = process.env.TTSC_E2E_TRACE;
  if (configuredTraceRoot !== undefined)
    assert.ok(path.isAbsolute(configuredTraceRoot));
  const traceRoot = TestProject.tmpdir(
    "ttsc-loader-pool-observations-",
    configuredTraceRoot,
  );
  try {
    fs.writeFileSync(
      path.join(traceRoot, "preparation-environment.json"),
      JSON.stringify({
        cwd: workspace.root,
        pluginCache: workspace.cache,
        GOCACHE: process.env.GOCACHE ?? null,
        TTSC_GO_CACHE_DIR: process.env.TTSC_GO_CACHE_DIR ?? null,
        workerModes: ["metro", "turbopack"],
      }),
    );
    const recreatedOutputDirectory = path.join(
      workspace.root,
      "dist/batch-recreated-output",
    );
    assert.equal(
      fs.existsSync(recreatedOutputDirectory),
      false,
      "the pool owns its output recreation subtree exclusively",
    );
    const contractPath = path.join(workspace.root, "src/contract.ts");
    const originalContract = fs.readFileSync(contractPath);
    const bannerPath = path.join(
      workspace.root,
      "config",
      "banner.config.json",
    );
    const originalBanner = fs.readFileSync(bannerPath);
    const deliveredPaths = [
      path.join(workspace.root, "src/bundle.ts"),
      path.join(workspace.root, "src/pool-routing/map.ts"),
    ];
    const originalDelivered = deliveredPaths.map((file) =>
      fs.readFileSync(file, "utf8"),
    );
    const configPath = path.join(workspace.root, "tsconfig.json");
    const originalConfig = fs.readFileSync(configPath);
    const nonInputRaceFile = path.join(
      workspace.root,
      "batch-native-non-input.log",
    );
    const nonInputRaceContent =
      "written by actual ApplyProgram while capture is active\n";
    assert.equal(fs.existsSync(nonInputRaceFile), false);
    const poolConfig = JSON.parse(originalConfig.toString("utf8"));
    const nativeProbe = poolConfig.compilerOptions.plugins.find(
      (entry: { name?: string }) => entry.name === "shared-real-program-probe",
    );
    assert.ok(
      nativeProbe,
      "the existing native producer must own the capture-time write",
    );
    const publicNativeProbe = {
      ...nativeProbe,
      fixtureSource: path.join(
        path.dirname(nativeProbe.fixtureSource),
        "cmd/public-probe",
      ),
      publicCommand: true,
    };
    // Public preparation pays for this same producer before either adapter starts.
    // Two simultaneous instance cache owners differ only in their environment;
    // neither call starts a TypeScript Program or executes a transform hook.
    const publicApiFailures: unknown[] = [];
    const baselineBuildEnv = {
      ...process.env,
      GOFLAGS: "-tags=ttsc_build_environment_probe_baseline",
    };
    try {
      const apiRoots = [
        ".cache/public-a/ttsc",
        ".cache/public-b/ttsc",
      ] as const;
      const apiManifestBytes = fs.readFileSync(
        path.join(workspace.root, "package.json"),
      );
      const apiDescriptorBytes = fs.readFileSync(
        path.join(workspace.root, "descriptors/default.cjs"),
      );
      const apiSourceBytes = await FileSystemIterator.read(
        nativeProbe.fixtureSource,
      );
      const apiOutputRoot = path.join(workspace.root, "dist");
      const apiOutputExisted = fs.existsSync(apiOutputRoot);
      const apiOutputBytes = apiOutputExisted
        ? await FileSystemIterator.read(apiOutputRoot)
        : undefined;
      for (const relative of apiRoots)
        assert.equal(
          fs.existsSync(path.join(workspace.root, relative)),
          false,
          "public preparation owns a fresh instance cache",
        );
      const ambientCache = process.env.TTSC_CACHE_DIR;
      // Preserve inherited object-cache authority; only the default case
      // shares B's existing objects while binary namespaces remain independent.
      const sharedObjectCacheEnv: NodeJS.ProcessEnv =
        SidecarEnvironment.read(process.env, "TTSC_GO_CACHE_DIR") ||
        SidecarEnvironment.read(process.env, "GOCACHE")
          ? {}
          : {
              TTSC_GO_CACHE_DIR: path.join(
                workspace.root,
                apiRoots[1],
                "go-build",
              ),
            };
      const compilerA = new TtscCompiler({
        cwd: workspace.root,
        plugins: [publicNativeProbe],
        env: {
          TTSC_CACHE_DIR: apiRoots[0],
          ...sharedObjectCacheEnv,
          GOFLAGS: baselineBuildEnv.GOFLAGS,
        },
      });
      const compilerB = new TtscCompiler({
        cwd: workspace.root,
        plugins: [publicNativeProbe],
        env: {
          TTSC_CACHE_DIR: apiRoots[1],
          ...sharedObjectCacheEnv,
          GOFLAGS: baselineBuildEnv.GOFLAGS,
        },
      });
      const preparedA = compilerA.prepare();
      const preparedB = compilerB.prepare();
      assert.equal(
        preparedA.length,
        1,
        "one authored selected native producer is prepared",
      );
      assert.equal(
        preparedB.length,
        1,
        "the other instance prepares that same selected producer",
      );
      const binaryA = preparedA[0]!;
      const binaryB = preparedB[0]!;
      const apiRootA = path.join(workspace.root, apiRoots[0]);
      const apiRootB = path.join(workspace.root, apiRoots[1]);
      assert.equal(
        binaryA.startsWith(path.join(apiRootA, "plugins") + path.sep),
        true,
      );
      assert.equal(
        binaryB.startsWith(path.join(apiRootB, "plugins") + path.sep),
        true,
      );
      assert.notEqual(binaryA, binaryB);
      assert.equal(fs.existsSync(binaryA), true);
      assert.equal(fs.existsSync(binaryB), true);
      assert.equal(binaryA.startsWith(apiRootB + path.sep), false);
      assert.equal(binaryB.startsWith(apiRootA + path.sep), false);
      assert.equal(
        process.env.TTSC_CACHE_DIR,
        ambientCache,
        "instance environments must not mutate the host environment",
      );
      const sourceModule = path.dirname(nativeProbe.fixtureSource);
      const preparedSourceState = pluginSourceState(sourceModule, {
        env: baselineBuildEnv,
      });
      const refusedPluginCache = path.join(sourceModule, "keyed-plugin-cache");
      const refusedGoCache = path.join(sourceModule, "keyed-go-cache");
      const outsideAdmissionCache = path.join(
        workspace.root,
        ".cache/public-admission/ttsc",
      );
      const refusal =
        (cache: string) =>
        (error: unknown): boolean =>
          error instanceof Error &&
          error.message.includes(
            `the cache ${cache} lies inside the plugin source`,
          ) &&
          error.message.includes(sourceModule);
      assert.equal(fs.existsSync(refusedPluginCache), false);
      assert.throws(
        () =>
          new TtscCompiler({
            cwd: workspace.root,
            plugins: [publicNativeProbe],
            cacheDir: refusedPluginCache,
          }).prepare(),
        refusal(refusedPluginCache),
      );
      assert.deepEqual(
        fs.readdirSync(refusedPluginCache),
        ["descriptors"],
        "descriptor evaluation precedes source-build admission; no plugin or Go build cache may be published",
      );
      const refusedDescriptorRecords = fs.readdirSync(
        path.join(refusedPluginCache, "descriptors"),
      );
      assert.equal(
        refusedDescriptorRecords.length,
        1,
        "the single evaluated descriptor owns its cache record",
      );
      assert.match(refusedDescriptorRecords[0]!, /^[a-f0-9]+\.json$/);
      assert.equal(
        fs
          .statSync(
            path.join(
              refusedPluginCache,
              "descriptors",
              refusedDescriptorRecords[0]!,
            ),
          )
          .isFile(),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(refusedPluginCache, "plugins")),
        false,
      );
      assert.equal(
        fs.existsSync(path.join(refusedPluginCache, "go-build")),
        false,
      );
      // The refusal owns this descriptor record, but it must not become an
      // unrelated source mutation between the prepared and pruned-byte epochs.
      assert.equal(
        path.dirname(path.resolve(refusedPluginCache)),
        path.resolve(sourceModule),
      );
      fs.unlinkSync(
        path.join(
          refusedPluginCache,
          "descriptors",
          refusedDescriptorRecords[0]!,
        ),
      );
      fs.rmdirSync(path.join(refusedPluginCache, "descriptors"));
      fs.rmdirSync(refusedPluginCache);
      assert.equal(
        pluginSourceState(sourceModule, { env: baselineBuildEnv }),
        preparedSourceState,
        "refusal cleanup restores the prepared source population before pruned-byte controls",
      );
      assert.throws(
        () =>
          new TtscCompiler({
            cwd: workspace.root,
            plugins: [publicNativeProbe],
            cacheDir: outsideAdmissionCache,
            env: { TTSC_GO_CACHE_DIR: refusedGoCache },
          }).prepare(),
        refusal(refusedGoCache),
      );
      const excludedCacheRoot = path.join(
        sourceModule,
        "node_modules/.cache/public-admission",
      );
      const excludedCompiler = new TtscCompiler({
        cwd: workspace.root,
        plugins: [publicNativeProbe],
        cacheDir: path.join(excludedCacheRoot, "plugins"),
        env: { TTSC_GO_CACHE_DIR: path.join(excludedCacheRoot, "go") },
      });
      const excludedPrepared = excludedCompiler.prepare();
      assert.equal(excludedPrepared.length, 1);
      assert.equal(
        fs.existsSync(excludedPrepared[0]!),
        true,
        "both publication and Go caches below a pruned directory are admitted by the actual prepare caller",
      );
      const producerFile = path.join(nativeProbe.fixtureSource, "probe.go");
      const originalProducer = fs.readFileSync(producerFile);
      const excludedGo = path.join(
        sourceModule,
        "node_modules/public-state/ignored.go",
      );
      const backupGo = path.join(sourceModule, "ignored.go~");
      const excludedGit = path.join(
        sourceModule,
        ".git/public-state-ignored.go",
      );
      assert.equal(fs.existsSync(excludedGit), false);
      assert.equal(prunesPluginSourceDirectory("node_modules"), true);
      assert.equal(prunesPluginSourceDirectory(".git"), true);
      assert.equal(prunesPluginSourceDirectory("internal"), false);
      assert.equal(fs.existsSync(excludedGo), false);
      assert.equal(fs.existsSync(backupGo), false);
      try {
        const expectedOriginalState = pluginSourceState(sourceModule, {
          env: baselineBuildEnv,
        });
        const first = compilerB.transform();
        assert.equal(
          first.type,
          "success",
          "the public API must acquire the actual native source envelope",
        );
        if (first.type !== "success")
          throw new Error("initial public source envelope failed");
        assert.ok(
          Array.isArray(first.dependenciesComplete),
          "the existing single-reporter public transform must acquire positive native completeness",
        );
        const completeNativePath = (file: string) =>
          path.resolve(workspace.root, file).replace(/\\/g, "/");
        assert.deepEqual(
          first.dependenciesComplete.map(completeNativePath).sort(),
          ["src/bundle.ts", "src/map.ts", "src/pool-routing/map.ts"]
            .map(completeNativePath)
            .sort(),
          "only the actual loaded sources explicitly reported by this sole contributor are complete",
        );
        assert.ok(
          Object.keys(first.typescript).some(
            (file) =>
              completeNativePath(file) ===
              completeNativePath("src/native-pipeline.ts"),
          ),
          "the same acquired Program contains an unmarked transformed sibling",
        );
        const reportedMapDependencies = first.dependencies?.["src/map.ts"];
        assert.ok(
          reportedMapDependencies,
          "the public transformation must expose the actual native reporter envelope",
        );
        for (const input of [
          "src/contract.ts",
          "src/console.d.ts",
          "native-source-first/map.ts",
          "native-source-second/map.ts",
        ])
          assert.equal(
            reportedMapDependencies.filter((dependency) => dependency === input)
              .length,
            1,
            "the native relative/absolute/duplicate dependency controls normalize to one lexical report: " +
              input,
          );
        assert.equal(
          reportedMapDependencies.includes("src/map.ts"),
          false,
          "native aggregation drops the exact self report without dropping the two aliases",
        );
        assert.deepEqual(Object.keys(first.pluginSources ?? {}).sort(), [
          fs.realpathSync.native(sourceModule),
        ]);
        const originalState =
          first.pluginSources![fs.realpathSync.native(sourceModule)];
        assert.equal(
          originalState,
          expectedOriginalState,
          "the public native envelope must carry the state of the source bytes acquired before execution",
        );
        fs.mkdirSync(path.dirname(excludedGo), { recursive: true });
        fs.writeFileSync(excludedGo, "package ignored\n");
        fs.writeFileSync(backupGo, "backup input\n");
        fs.mkdirSync(path.dirname(excludedGit), { recursive: true });
        fs.writeFileSync(excludedGit, "package ignored\n");
        assert.equal(
          pluginSourceState(sourceModule, { env: baselineBuildEnv }),
          expectedOriginalState,
          "pruned and backup bytes must not join source ownership",
        );
        assert.deepEqual(
          compilerB.prepare(),
          preparedB,
          "pruned bytes must retain the actual selected binary",
        );
        fs.appendFileSync(producerFile, "\n// public source-state epoch\n");
        const expectedEditedState = pluginSourceState(sourceModule, {
          env: baselineBuildEnv,
        });
        assert.notEqual(expectedEditedState, expectedOriginalState);
        const edited = compilerB.transform();
        assert.equal(edited.type, "success");
        if (edited.type !== "success")
          throw new Error("edited public source envelope failed");
        assert.notEqual(
          edited.pluginSources?.[fs.realpathSync.native(sourceModule)],
          originalState,
        );
        assert.equal(
          edited.pluginSources?.[fs.realpathSync.native(sourceModule)],
          expectedEditedState,
        );
        const editedBinaries = compilerB.prepare();
        assert.equal(editedBinaries.length, 1);
        assert.notEqual(
          editedBinaries[0],
          binaryB,
          "the actual source mutation must publish another keyed binary",
        );
        const flaggedCompiler = new TtscCompiler({
          cwd: workspace.root,
          plugins: [publicNativeProbe],
          env: {
            TTSC_CACHE_DIR: apiRoots[1],
            GOFLAGS: "-tags=ttsc_build_environment_probe",
          },
        });
        const expectedFlaggedState = pluginSourceState(sourceModule, {
          env: {
            ...process.env,
            GOFLAGS: "-tags=ttsc_build_environment_probe",
          },
        });
        assert.notEqual(expectedFlaggedState, expectedEditedState);
        const flagged = flaggedCompiler.transform();
        assert.equal(flagged.type, "success");
        if (flagged.type !== "success")
          throw new Error("environment public source envelope failed");
        assert.notEqual(
          flagged.pluginSources?.[fs.realpathSync.native(sourceModule)],
          edited.pluginSources?.[fs.realpathSync.native(sourceModule)],
        );
        assert.equal(
          flagged.pluginSources?.[fs.realpathSync.native(sourceModule)],
          expectedFlaggedState,
        );
        assert.notEqual(flaggedCompiler.prepare()[0], editedBinaries[0]);
        const plain = new TtscCompiler({
          cwd: workspace.root,
          plugins: false,
          env: {
            TTSC_CACHE_DIR: apiRoots[1],
            GOFLAGS: baselineBuildEnv.GOFLAGS,
          },
        }).transform();
        assert.equal(plain.type, "success");
        if (plain.type !== "success")
          throw new Error("plugin-free public source envelope failed");
        assert.equal(
          plain.pluginSources,
          undefined,
          "a plugin-free operation must not report another owner's native source state",
        );
      } finally {
        fs.writeFileSync(producerFile, originalProducer);
        fs.rmSync(path.join(sourceModule, "node_modules/public-state"), {
          recursive: true,
          force: true,
        });
        fs.rmSync(backupGo, { force: true });
        fs.rmSync(excludedGit, { force: true });
      }
      const legacyTargets = [
        path.join(workspace.root, "node_modules/.ttsc"),
        path.join(workspace.root, ".ttsc"),
      ];
      const preservedLegacy = path.join(
        workspace.root,
        "tools/public-clean-preserved",
      );
      assert.equal(fs.existsSync(preservedLegacy), false);
      fs.mkdirSync(preservedLegacy);
      const heldLegacy: { target: string; saved: string }[] = [];
      const ownedLegacy: string[] = [];
      try {
        for (const [index, target] of legacyTargets.entries()) {
          assert.equal(
            path.relative(workspace.root, target).startsWith(".."),
            false,
          );
          if (fs.existsSync(target)) {
            const saved = path.join(preservedLegacy, String(index));
            fs.renameSync(target, saved);
            heldLegacy.push({ target, saved });
          }
          fs.mkdirSync(target);
          ownedLegacy.push(target);
          fs.writeFileSync(
            path.join(target, "public-clean-owned"),
            "legacy cleanup input\n",
          );
        }
        const explicitCleaner = new TtscCompiler({
          cwd: workspace.root,
          cacheDir: apiRootA,
        });
        assert.deepEqual(
          explicitCleaner.clean(),
          [apiRootA, ...legacyTargets],
          "explicit clean also owns the two existing project legacy targets",
        );
        assert.equal(fs.existsSync(apiRootA), false);
        for (const target of legacyTargets)
          assert.equal(fs.existsSync(target), false);
        const goCacheB = path.join(apiRootB, "go-build");
        fs.mkdirSync(goCacheB, { recursive: true });
        fs.writeFileSync(path.join(goCacheB, "seed"), "go object\n");
        const descriptorCacheB = path.join(apiRootB, "descriptors");
        assert.equal(
          fs.statSync(descriptorCacheB).isDirectory(),
          true,
          "actual descriptor evaluation publishes its owned cache before clean",
        );
        assert.notEqual(fs.readdirSync(descriptorCacheB).length, 0);
        const unrelatedCacheB = path.join(apiRootB, "unowned-neighbor");
        fs.writeFileSync(unrelatedCacheB, "preserve unrelated cache bytes\n");
        assert.deepEqual(compilerB.clean(), [
          path.join(apiRootB, "plugins"),
          descriptorCacheB,
          goCacheB,
        ]);
        assert.equal(fs.existsSync(path.join(apiRootB, "plugins")), false);
        assert.equal(fs.existsSync(descriptorCacheB), false);
        assert.equal(fs.existsSync(goCacheB), false);
        assert.equal(
          fs.readFileSync(unrelatedCacheB, "utf8"),
          "preserve unrelated cache bytes\n",
        );
      } finally {
        for (const target of ownedLegacy) {
          const sentinel = path.join(target, "public-clean-owned");
          if (fs.existsSync(sentinel)) fs.unlinkSync(sentinel);
          if (fs.existsSync(target)) fs.rmdirSync(target);
        }
        for (const { target, saved } of heldLegacy)
          fs.renameSync(saved, target);
        fs.rmdirSync(preservedLegacy);
      }
      assert.deepEqual(
        fs.readFileSync(configPath),
        originalConfig,
        "public prepare/clean must not rewrite the shared compiler input",
      );
      assert.deepEqual(
        fs.readFileSync(path.join(workspace.root, "package.json")),
        apiManifestBytes,
      );
      assert.deepEqual(
        fs.readFileSync(path.join(workspace.root, "descriptors/default.cjs")),
        apiDescriptorBytes,
      );
      assert.deepEqual(
        await FileSystemIterator.read(nativeProbe.fixtureSource),
        apiSourceBytes,
        "public preparation and cleanup must preserve the existing native producer's input tree",
      );
      assert.equal(
        fs.existsSync(apiOutputRoot),
        apiOutputExisted,
        "public in-memory source operations must not publish project output",
      );
      if (apiOutputBytes !== undefined)
        assert.deepEqual(
          await FileSystemIterator.read(apiOutputRoot),
          apiOutputBytes,
        );
    } catch (error) {
      publicApiFailures.push(
        new Error("public preparation, instance cache and cleanup population", {
          cause: error,
        }),
      );
    }
    const descriptorSettings = path.join(
      workspace.root,
      "descriptors/cache-settings.json",
    );
    const descriptorModule = path.join(
      workspace.root,
      "descriptors/cache-input.cjs",
    );
    const originalSettings = fs.readFileSync(descriptorSettings);
    const originalDescriptorModule = fs.readFileSync(descriptorModule);
    const descriptorCache = path.join(
      workspace.root,
      ".cache/descriptor-observations/ttsc",
    );
    const descriptorEnv = {
      ...process.env,
      TTSC_NODE_BINARY: process.execPath,
      GOFLAGS: "-tags=ttsc_build_environment_probe_baseline",
    };
    // This existing recorder probes the actual public hook consulted by the
    // evaluator's selected executable, not a Node-version or OS assumption.
    const runtimeRequireResolveAvailable =
      RuntimeLoaderCapabilities.requireResolveConsultsHooks();
    const recorderRequireResolveAvailable = (
      createRequire(import.meta.url)(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/ttsc/driver/resolutioninputs/recorder.cjs",
        ),
      ) as { requireResolveConsultsHooks(): boolean }
    ).requireResolveConsultsHooks();
    assert.equal(
      runtimeRequireResolveAvailable,
      recorderRequireResolveAvailable,
      "the selected executable must give both actual hook owners the same capability",
    );
    // The owned descriptor resolver supplies observed resolution on the supported
    // floor even when ordinary require.resolve does not consult public hooks.
    // Keep the independent capability contrast above, but require the owned
    // descriptor contract rather than withdrawing reuse on that unrelated probe.
    const descriptorReuseAvailable = true;
    // One physical descriptor, dependency, settings file and native producer own
    // these observation-authority epochs. Rows change the declared read contract;
    // they do not allocate projects, launch old recipes or reset a row's cache.
    for (const observation of [
      "module",
      "qualified",
      "undeclared",
      "unproved",
      "isolation",
      "collection",
    ] as const) {
      const counter = path.join(
        traceRoot,
        "descriptor-" + observation + ".txt",
      );
      const entry = {
        ...nativeProbe,
        ...(observation === "collection"
          ? {
              transform: path.join(workspace.root, "descriptors/default.cjs"),
            }
          : {}),
        cacheObservation: observation,
        evaluationCounter: counter,
      };
      const effectiveDescriptorEnv: NodeJS.ProcessEnv =
        observation === "collection"
          ? { ...descriptorEnv, TTSC_CACHE_DIR: undefined }
          : descriptorEnv;
      const load = (
        env: NodeJS.ProcessEnv = effectiveDescriptorEnv,
      ): string | undefined => {
        const loaded = loadProjectPlugins({
          binary: TestProject.TSGO_BINARY,
          cwd:
            observation === "collection"
              ? workspace.descriptorCollectionRoot
              : workspace.root,
          cacheDir: observation === "collection" ? undefined : descriptorCache,
          entries: [entry],
          env,
          tsconfig:
            observation === "collection"
              ? path.join(workspace.descriptorCollectionRoot, "tsconfig.json")
              : configPath,
        });
        if (!descriptorReuseAvailable)
          assert.equal(
            loaded.observationsComplete,
            false,
            "the independently unsupported resolve observer cannot certify this descriptor",
          );
        if (!descriptorReuseAvailable && observation !== "collection") {
          const directory = path.join(descriptorCache, "descriptors");
          assert.deepEqual(
            fs.existsSync(directory)
              ? fs
                  .readdirSync(directory)
                  .filter((file) => file.endsWith(".json"))
              : [],
            [],
            "an independently unavailable observer must not persist any descriptor answer in this fresh namespace",
          );
        }
        return loaded.nativePlugins[0]?.name;
      };
      const evaluations = (): number =>
        fs.existsSync(counter) ? fs.readFileSync(counter, "utf8").length : 0;
      try {
        assert.equal(fs.existsSync(counter), false);
        fs.writeFileSync(descriptorSettings, '{"name":"first"}\n');
        fs.writeFileSync(
          descriptorModule,
          'module.exports = { name: "first" };\n',
        );
        if (observation === "isolation") {
          fs.writeFileSync(
            descriptorModule,
            'module.exports = { name: "bad" };\n',
          );
          const applicationRequire = createRequire(import.meta.url);
          const applicationSingleton = applicationRequire(descriptorModule);
          assert.equal(applicationSingleton.name, "bad");
          const isolatedLoad = () =>
            loadProjectPlugins({
              binary: TestProject.TSGO_BINARY,
              cwd: workspace.root,
              cacheDir: descriptorCache,
              entries: [entry],
              env: descriptorEnv,
              tsconfig: configPath,
            });
          assert.throws(isolatedLoad, /descriptor is bad/);
          fs.writeFileSync(
            descriptorModule,
            'module.exports = { name: "good" };\n',
          );
          const selected = isolatedLoad();
          const getterJson = path.join(
            workspace.root,
            "descriptors/cache-source.json",
          );
          const absentGetterJs = path.join(
            workspace.root,
            "descriptors/cache-source.js",
          );
          assert.equal(fs.existsSync(absentGetterJs), false);
          assert.ok(selected.hostInputs.includes(descriptorModule));
          assert.ok(selected.hostInputs.includes(getterJson));
          assert.ok(selected.hostInputs.includes(absentGetterJs));
          assert.equal(
            selected.hostInputRealpaths[descriptorModule],
            fs.realpathSync.native(descriptorModule),
          );
          assert.equal(
            selected.hostInputRealpaths[getterJson],
            fs.realpathSync.native(getterJson),
          );
          assert.equal(selected.nativePlugins[0]?.name, "good");
          assert.equal(isolatedLoad().nativePlugins[0]?.name, "good");
          assert.equal(
            applicationRequire(descriptorModule),
            applicationSingleton,
            "isolated generations must preserve the application's loaded singleton",
          );
          assert.equal(
            applicationSingleton.name,
            "bad",
            "the application's retained value must not be replaced by the evaluator's good generation",
          );
          continue;
        }
        if (observation === "collection") {
          const descriptors = path.join(
            workspace.descriptorCollectionRoot,
            "node_modules/.cache/ttsc/descriptors",
          );
          assert.equal(
            fs.existsSync(descriptors),
            false,
            "the independent upfront package owns a fresh default descriptor cache",
          );
          assert.equal(load(), "collected");
          if (!descriptorReuseAvailable) {
            assert.equal(
              fs.existsSync(descriptors),
              false,
              "incomplete observation must not publish an evaluator answer",
            );
            assert.equal(load(), "collected");
            assert.equal(
              evaluations(),
              2,
              "both unsupported-observer requests must execute a fresh factory",
            );
            assert.equal(fs.existsSync(descriptors), false);
            continue;
          }
          const entries = fs
            .readdirSync(descriptors)
            .filter((name) => name.endsWith(".json"));
          assert.equal(
            entries.length,
            1,
            "one actual isolated evaluator answer is recorded",
          );
          const used = path.join(descriptors, entries[0]!);
          const unused = path.join(descriptors, "unused.json");
          fs.writeFileSync(unused, "{}");
          const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
          fs.utimesSync(used, old, old);
          fs.utimesSync(unused, old, old);
          fs.rmSync(path.join(descriptors, ".gc-last-run"), { force: true });
          assert.equal(load(), "collected");
          assert.equal(
            evaluations(),
            descriptorReuseAvailable ? 1 : 2,
            "the aged in-use answer must be reused before collection",
          );
          assert.equal(
            fs.existsSync(unused),
            false,
            "actual maintenance must remove the unused aged record",
          );
          assert.equal(
            fs.existsSync(used),
            true,
            "actual maintenance must preserve its used record",
          );
          assert.ok(
            fs.statSync(used).mtimeMs > old.getTime(),
            "the cache hit must renew actual recorded use",
          );
          continue;
        }
        assert.equal(
          load(),
          "first",
          "the isolated evaluator must return the authored initial name: " +
            observation,
        );
        if (observation === "module") {
          assert.equal(load(), "first");
          assert.equal(
            evaluations(),
            descriptorReuseAvailable ? 1 : 2,
            "an observed CJS graph reuses its evaluation; an independently unsupported observer must evaluate each request",
          );
          fs.writeFileSync(
            descriptorModule,
            'module.exports = { name: "second" };\n',
          );
          assert.equal(
            load(),
            "second",
            "the isolated CJS generation must load the edited dependency value",
          );
          assert.equal(evaluations(), descriptorReuseAvailable ? 2 : 3);
          assert.equal(
            load({ ...descriptorEnv, DESCRIPTOR_PROBE: "changed" }),
            "second",
          );
          assert.equal(
            evaluations(),
            descriptorReuseAvailable ? 3 : 4,
            "an effective evaluator environment change cannot borrow the earlier generation",
          );
        } else {
          if (observation === "qualified") {
            assert.equal(load(), "first");
            assert.equal(
              evaluations(),
              descriptorReuseAvailable ? 1 : 2,
              "declared settings plus available module observation permit reuse; unsupported observation requires fresh evaluation",
            );
          }
          fs.writeFileSync(descriptorSettings, '{"name":"second"}\n');
          assert.equal(
            load(),
            "second",
            "changed read bytes must reach the actual factory return: " +
              observation,
          );
          assert.equal(
            evaluations(),
            observation === "qualified" && !descriptorReuseAvailable ? 3 : 2,
            "missing or changed read authority must re-evaluate: " +
              observation,
          );
        }
      } catch (error) {
        publicApiFailures.push(
          new Error("isolated descriptor observation flow: " + observation, {
            cause: error,
          }),
        );
      } finally {
        fs.writeFileSync(descriptorSettings, originalSettings);
        fs.writeFileSync(descriptorModule, originalDescriptorModule);
      }
    }
    // Both descriptor formats consume the same selected package and three lookup
    // epochs. No epoch prepares a private project, toolchain or producer.
    const selectionScope = path.join(
      workspace.root,
      "descriptors/package.json",
    );
    const selectionOuter = path.join(
      workspace.root,
      "node_modules/batch-observation-selection",
    );
    const selectionNearer = path.join(
      workspace.root,
      "descriptors/node_modules/batch-observation-selection",
    );
    const selectionSibling = path.join(
      workspace.root,
      "descriptor-search-sibling",
    );
    const scopedSelectionOuter = path.join(
      workspace.root,
      "node_modules/@batch/observation-selection",
    );
    const scopedSelectionNearer = path.join(
      workspace.root,
      "descriptors/node_modules/@batch/observation-selection",
    );
    for (const owned of [
      selectionScope,
      selectionOuter,
      selectionNearer,
      selectionSibling,
    ])
      assert.equal(
        fs.existsSync(owned),
        false,
        "search epochs own initially absent paths",
      );
    const physicalSelectionPath = (file: string): string => {
      try {
        return fs.realpathSync.native(file);
      } catch (error) {
        if (
          !["ENOENT", "ENOTDIR"].includes(
            (error as NodeJS.ErrnoException).code ?? "",
          )
        )
          throw error;
        const parent = path.dirname(file);
        if (parent === file) throw error;
        return path.join(physicalSelectionPath(parent), path.basename(file));
      }
    };
    try {
      fs.writeFileSync(
        selectionScope,
        JSON.stringify({
          private: true,
          type: "commonjs",
          imports: {
            "#local-descriptor": "./input.cjs",
            "#installed-descriptor": "batch-descriptor-input",
            "#missing-local-descriptor": "./optional.cjs",
            "#missing-package-descriptor": "batch-absent-descriptor-input",
            "#observation-selection": "batch-observation-selection",
          },
        }),
      );
      fs.mkdirSync(selectionOuter, { recursive: true });
      fs.writeFileSync(
        path.join(selectionOuter, "package.json"),
        '{"name":"batch-observation-selection","main":"index.js"}\n',
      );
      fs.writeFileSync(
        path.join(selectionOuter, "index.js"),
        'module.exports = "selection";\n',
      );
      fs.mkdirSync(path.dirname(selectionNearer), { recursive: true });
      for (const selectionMode of [
        "bare-aba",
        "mapped-aba",
        "selected-cutoff",
      ] as const) {
        if (selectionMode === "selected-cutoff")
          fs.cpSync(selectionOuter, selectionNearer, { recursive: true });
        for (const transform of [
          "./descriptors/default.cjs",
          "./descriptors/selection.ts",
        ] as const) {
          try {
            const loaded = loadProjectPlugins({
              binary: TestProject.TSGO_BINARY,
              cwd: workspace.root,
              tsconfig: configPath,
              cacheDir: path.join(workspace.cache, "descriptor-search-flow"),
              env: descriptorEnv,
              entries: [
                {
                  ...publicNativeProbe,
                  transform,
                  selectionMode,
                  selectionNearer,
                  selectionSibling,
                },
              ],
            });
            assert.equal(loaded.nativePlugins[0]?.name, "selection");
            const recorded = (file: string): boolean =>
              loaded.hostInputs.some(
                (input) =>
                  physicalSelectionPath(input) === physicalSelectionPath(file),
              );
            const proven = (file: string): boolean =>
              loaded.hostInputs.some(
                (input) =>
                  physicalSelectionPath(input) ===
                    physicalSelectionPath(file) &&
                  Object.hasOwn(loaded.hostInputHashes, input),
              );
            const selected =
              selectionMode === "selected-cutoff"
                ? selectionNearer
                : selectionOuter;
            assert.equal(
              recorded(path.join(selected, "index.js")),
              true,
              "selected package is an actual evaluator input",
            );
            assert.equal(
              proven(path.join(selected, "index.js")),
              true,
              "selected bytes keep their own proof",
            );
            if (selectionMode === "selected-cutoff") {
              const nativeBannerInput = path.join(
                workspace.root,
                "config/banner.config.json",
              );
              assert.deepEqual(
                loaded.deferredHostInputs,
                [nativeBannerInput],
                "the forwarded native config is distinct from evaluator-consumed inputs",
              );
              assert.equal(loaded.hostInputs.includes(nativeBannerInput), true);
              assert.equal(
                Object.hasOwn(loaded.hostInputHashes, nativeBannerInput),
                false,
                "the evaluator must not invent proof for unread native config",
              );
              assert.deepEqual(
                loaded.hostInputs.filter(
                  (input) =>
                    !loaded.deferredHostInputs.includes(input) &&
                    !Object.hasOwn(loaded.hostInputHashes, input),
                ),
                [],
                "unrelated parent churn must preserve every evaluator-owned proof",
              );
            } else {
              assert.equal(
                recorded(selectionNearer),
                true,
                "the actual nearer candidate is observed before it appears",
              );
              assert.equal(
                proven(selectionNearer),
                false,
                "a nearer candidate that came and went cannot retain absence proof",
              );
            }
            const allowedRoots = (
              selectionMode === "selected-cutoff"
                ? [path.dirname(selectionNearer)]
                : [path.dirname(selectionNearer), path.dirname(selectionOuter)]
            ).map(physicalSelectionPath);
            assert.deepEqual(
              loaded.hostInputs.filter(
                (input) =>
                  input.includes(
                    path.join("node_modules", "batch-observation-selection"),
                  ) &&
                  !allowedRoots.some((root) =>
                    physicalSelectionPath(input).startsWith(root + path.sep),
                  ),
              ),
              [],
              "search stops at its independently selected package root",
            );
          } catch (error) {
            publicApiFailures.push(
              new Error(
                selectionMode + " actual descriptor selection: " + transform,
                { cause: error },
              ),
            );
          }
        }
      }
      fs.rmSync(selectionNearer, { recursive: true });
      for (const layout of [
        "hoisted-bare",
        "hoisted-subpath",
        "local-bare",
      ] as const) {
        const scoped = layout === "hoisted-subpath";
        const packageName = scoped
          ? "@batch/observation-selection"
          : "batch-observation-selection";
        const nearer = scoped ? scopedSelectionNearer : selectionNearer;
        const installed =
          layout === "local-bare"
            ? nearer
            : scoped
              ? scopedSelectionOuter
              : selectionOuter;
        const manifestBytes = JSON.stringify({
          name: packageName,
          main: "index.js",
        });
        fs.mkdirSync(installed, { recursive: true });
        fs.writeFileSync(path.join(installed, "package.json"), manifestBytes);
        fs.writeFileSync(
          path.join(installed, "index.js"),
          'module.exports = "selection";\n',
        );
        fs.writeFileSync(
          path.join(installed, "sub.js"),
          'module.exports = "selection";\n',
        );
        const scope = JSON.parse(fs.readFileSync(selectionScope, "utf8"));
        scope.imports["#observation-selection"] =
          packageName + (scoped ? "/sub.js" : "");
        fs.writeFileSync(selectionScope, JSON.stringify(scope));
        const recordedNearerManifests: string[] = [];
        for (const transform of [
          "./descriptors/default.cjs",
          "./descriptors/selection.ts",
        ] as const) {
          try {
            const loaded = loadProjectPlugins({
              binary: TestProject.TSGO_BINARY,
              cwd: workspace.root,
              tsconfig: configPath,
              cacheDir: path.join(workspace.cache, "descriptor-search-flow"),
              env: descriptorEnv,
              entries: [
                {
                  ...publicNativeProbe,
                  transform,
                  selectionMode: "mapped-record",
                  selectionSpecifier: "#observation-selection",
                },
              ],
            });
            const recorded = (file: string): string | undefined =>
              loaded.hostInputs.find(
                (input) =>
                  physicalSelectionPath(input) === physicalSelectionPath(file),
              );
            const selectedInput = recorded(
              path.join(installed, scoped ? "sub.js" : "index.js"),
            );
            assert.ok(
              selectedInput,
              "mapped package's actual selected module is an input: " + layout,
            );
            assert.equal(
              Object.hasOwn(loaded.hostInputHashes, selectedInput),
              true,
            );
            const searchSuffix = path.join(
              "node_modules",
              ...packageName.split("/"),
            );
            const allowed = (
              layout === "local-bare"
                ? [path.dirname(nearer)]
                : [path.dirname(nearer), path.dirname(installed)]
            ).map(physicalSelectionPath);
            assert.deepEqual(
              loaded.hostInputs.filter(
                (input) =>
                  input.includes(searchSuffix) &&
                  !allowed.some((root) =>
                    physicalSelectionPath(input).startsWith(root + path.sep),
                  ),
              ),
              [],
              "mapped lookup must stop at selected root: " + layout,
            );
            if (layout !== "local-bare") {
              const candidate = recorded(path.join(nearer, "package.json"));
              assert.ok(
                candidate,
                "the actual nearer manifest remains an input: " + layout,
              );
              assert.equal(
                Object.hasOwn(loaded.hostInputHashes, candidate),
                true,
              );
              assert.equal(
                loaded.hostInputHashes[candidate],
                null,
                "nearer manifest starts independently absent",
              );
              recordedNearerManifests.push(candidate);
            }
          } catch (error) {
            publicApiFailures.push(
              new Error(layout + " mapped descriptor input: " + transform, {
                cause: error,
              }),
            );
          }
        }
        if (layout !== "local-bare") {
          fs.mkdirSync(nearer, { recursive: true });
          fs.writeFileSync(path.join(nearer, "package.json"), manifestBytes);
          fs.writeFileSync(
            path.join(nearer, "index.js"),
            'module.exports = "selection";\n',
          );
          for (const candidate of recordedNearerManifests)
            assert.equal(
              fs.existsSync(candidate),
              true,
              "appearance changes the same recorded absence, without another lookup",
            );
          fs.rmSync(nearer, { recursive: true });
        }
      }
      const selectedDescriptorAlias = path.join(
        workspace.root,
        "node_modules/batch-selected-descriptor",
      );
      const rootManifestPath = path.join(workspace.root, "package.json");
      const manifestBeforeAlias = fs.readFileSync(rootManifestPath);
      const scopeBeforeAlias = fs.readFileSync(selectionScope);
      assert.equal(fs.existsSync(selectedDescriptorAlias), false);
      try {
        const scope = JSON.parse(scopeBeforeAlias.toString("utf8"));
        Object.assign(scope, {
          name: "batch-selected-descriptor",
          main: "default.cjs",
          version: "0.0.0",
          ttsc: {
            plugin: {
              ...publicNativeProbe,
              transform: "batch-selected-descriptor",
            },
          },
        });
        fs.writeFileSync(selectionScope, JSON.stringify(scope));
        const manifest = JSON.parse(manifestBeforeAlias.toString("utf8"));
        manifest.dependencies = { "batch-selected-descriptor": "0.0.0" };
        delete manifest.devDependencies;
        fs.writeFileSync(rootManifestPath, JSON.stringify(manifest));
        fs.symlinkSync(
          path.dirname(selectionScope),
          selectedDescriptorAlias,
          "junction",
        );
        const config = JSON.parse(originalConfig.toString("utf8"));
        config.compilerOptions.plugins = [
          {
            ...publicNativeProbe,
            transform: "./node_modules/batch-selected-descriptor/default.cjs",
          },
        ];
        fs.writeFileSync(configPath, JSON.stringify(config));
        const loaded = loadProjectPlugins({
          binary: TestProject.TSGO_BINARY,
          cwd: workspace.root,
          tsconfig: configPath,
          cacheDir: path.join(workspace.cache, "descriptor-search-flow"),
          env: descriptorEnv,
        });
        assert.equal(
          loaded.nativePlugins.length,
          1,
          "explicit linked path suppresses the same package's automatic marker",
        );
        assert.equal(
          loaded.nativePlugins[0]?.name,
          "shared-real-program-probe",
        );
        const externalConfigScope = path.join(
          workspace.root,
          "isolated-config",
        );
        assert.equal(fs.existsSync(externalConfigScope), false);
        try {
          fs.mkdirSync(externalConfigScope);
          fs.writeFileSync(
            path.join(externalConfigScope, "package.json"),
            '{"private":true}\n',
          );
          fs.writeFileSync(
            path.join(externalConfigScope, "tsconfig.json"),
            '{"compilerOptions":{"target":"ES2022"}}\n',
          );
          const ownedCache = path.join(
            workspace.root,
            ".cache/external-root/ttsc",
          );
          const compiler = new TtscCompiler({
            binary: TestProject.TSGO_BINARY,
            cwd: path.join(workspace.root, "descriptors"),
            projectRoot: "..",
            tsconfig: "../isolated-config/tsconfig.json",
            cacheDir: ownedCache,
            env: baselineBuildEnv,
          });
          const prepared = compiler.prepare();
          assert.equal(
            prepared.length,
            1,
            "explicit project root supplies package discovery across an unrelated config package scope",
          );
          assert.equal(fs.existsSync(prepared[0]!), true);
          assert.equal(
            prepared[0]!.startsWith(path.join(ownedCache, "plugins")),
            true,
            "native preparation is published under the consumer's literal cache",
          );
        } catch (error) {
          publicApiFailures.push(
            new Error(
              "public prepare project root across separate config authority",
              { cause: error },
            ),
          );
        } finally {
          assert.ok(
            path
              .resolve(externalConfigScope)
              .startsWith(path.resolve(workspace.root) + path.sep),
          );
          fs.rmSync(externalConfigScope, { recursive: true, force: true });
        }
      } catch (error) {
        publicApiFailures.push(
          new Error(
            "linked explicit descriptor versus package automatic discovery",
            { cause: error },
          ),
        );
      } finally {
        fs.writeFileSync(configPath, originalConfig);
        fs.writeFileSync(rootManifestPath, manifestBeforeAlias);
        fs.writeFileSync(selectionScope, scopeBeforeAlias);
        if (fs.existsSync(selectedDescriptorAlias)) {
          assert.equal(
            fs.lstatSync(selectedDescriptorAlias).isSymbolicLink(),
            true,
          );
          fs.unlinkSync(selectedDescriptorAlias);
        }
      }
    } catch (error) {
      publicApiFailures.push(
        new Error("shared descriptor search population", { cause: error }),
      );
    } finally {
      fs.rmSync(selectionScope, { force: true });
      for (const owned of [
        selectionOuter,
        selectionNearer,
        scopedSelectionOuter,
        scopedSelectionNearer,
        selectionSibling,
      ]) {
        assert.ok(
          path
            .resolve(owned)
            .startsWith(path.resolve(workspace.root) + path.sep),
        );
        fs.rmSync(owned, { recursive: true, force: true });
      }
    }
    const replacementModule = path.dirname(nativeProbe.fixtureSource);
    const replacementManifest = path.join(replacementModule, "go.mod");
    const originalReplacementManifest = fs.readFileSync(replacementManifest);
    const replacementInput = path.join(workspace.root, "replacement-input");
    const replacementFixture = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/unplugin/test/fixtures/source-replacement-input",
    );
    const replacementAlias = path.join(
      workspace.root,
      "replacement-input-alias",
    );
    const moduleAlias = path.join(workspace.root, "replacement-module-alias");
    const internalReplacement = path.join(
      replacementModule,
      "internal-replacement",
    );
    for (const owned of [
      replacementInput,
      replacementAlias,
      moduleAlias,
      internalReplacement,
    ])
      assert.equal(
        fs.existsSync(owned),
        false,
        "replacement epochs own initially absent input paths",
      );
    try {
      fs.cpSync(replacementFixture, replacementInput, { recursive: true });
      fs.symlinkSync(replacementInput, replacementAlias, "junction");
      fs.symlinkSync(replacementModule, moduleAlias, "junction");
      const manifest = (target: string): string =>
        originalReplacementManifest.toString("utf8") +
        "\nrequire example.com/batch-replacement v0.0.0\nreplace example.com/batch-replacement => " +
        JSON.stringify(target.split(path.sep).join("/")) +
        "\n";
      const expected = [
        fs.realpathSync.native(replacementInput),
        fs.realpathSync.native(replacementModule),
      ].sort();
      // These are directive epochs on one module and one loader cache. A changed
      // target does not materialize another project or replay an old fixture.
      for (const [spelling, target] of [
        ["absolute", replacementInput],
        ["relative", path.relative(replacementModule, replacementInput)],
        ["physical-link", replacementAlias],
      ] as const) {
        try {
          fs.writeFileSync(replacementManifest, manifest(target));
          let reported: readonly string[] | undefined;
          const loaded = loadProjectPlugins({
            binary: TestProject.TSGO_BINARY,
            cwd: workspace.root,
            tsconfig: configPath,
            cacheDir: path.join(
              workspace.root,
              ".cache/replacement-population/ttsc",
            ),
            env: descriptorEnv,
            entries: [publicNativeProbe],
            onWatchInputs: (inputs) => {
              reported = inputs;
            },
          });
          assert.deepEqual(
            reported,
            expected,
            "actual build roots must retain physical authority: " + spelling,
          );
          assert.deepEqual(
            Object.keys(loaded.pluginSources).sort(),
            expected,
            "actual source state must include the replacement and module: " +
              spelling,
          );
          assert.equal(loaded.nativePlugins.length, 1);
          assert.equal(
            fs.existsSync(loaded.nativePlugins[0]!.binary),
            true,
            "the actual source build must produce its selected executable: " +
              spelling,
          );
        } catch (error) {
          publicApiFailures.push(
            new Error("Go replacement source population: " + spelling, {
              cause: error,
            }),
          );
        }
      }
      fs.cpSync(replacementFixture, internalReplacement, { recursive: true });
      fs.writeFileSync(
        replacementManifest,
        manifest(path.join(moduleAlias, "internal-replacement")),
      );
      assert.deepEqual(
        pluginModuleReplaceDirectories(replacementModule, descriptorEnv),
        [],
        "actual Go directive JSON and physical containment must keep an aliased internal target inside its source owner",
      );
    } catch (error) {
      publicApiFailures.push(
        new Error("native Go replacement identity setup/internal control", {
          cause: error,
        }),
      );
    } finally {
      fs.writeFileSync(replacementManifest, originalReplacementManifest);
      // All targets are literal children of this owned temporary workspace.
      // Remove aliases as single links, without recursively traversing targets.
      for (const link of [replacementAlias, moduleAlias]) {
        if (fs.existsSync(link)) {
          assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
          fs.unlinkSync(link);
        }
      }
      for (const owned of [replacementInput, internalReplacement]) {
        assert.equal(
          path.relative(workspace.root, owned).startsWith(".."),
          false,
        );
        fs.rmSync(owned, { recursive: true, force: true });
      }
    }
    // The same module also supplies the controlled Go process protocol. Its
    // scripted child is an orchestration oracle, never a native compiler claim.
    const toolProtocol = path.join(workspace.root, "source-tool-protocol");
    const toolCache = path.join(toolProtocol, "cache");
    const toolEnvRecord = path.join(toolProtocol, "go-env.json");
    const toolInvocationLog = path.join(toolProtocol, "go-invocations.log");
    const copiedToolInputs = [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ];
    assert.equal(fs.existsSync(toolProtocol), false);
    const ownedToolDirectories = ["vendor", "lib", "dist", "build"];
    let toolInputsOwned = false;
    try {
      for (const relative of ownedToolDirectories)
        assert.equal(
          fs.existsSync(path.join(replacementModule, relative)),
          false,
        );
      toolInputsOwned = true;
      fs.mkdirSync(toolProtocol);
      const tool = createFakeGoBinary(toolProtocol);
      for (const relative of copiedToolInputs) {
        const target = path.join(replacementModule, relative);
        assert.equal(fs.existsSync(target), false);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(replacementFixture, "dep.go"), target);
      }
      const env: NodeJS.ProcessEnv = {
        ...baselineBuildEnv,
        GOCACHE: "",
        TTSC_GO_BINARY: tool,
        TTSC_GO_CACHE_DIR: path.join(toolProtocol, "instance-go-cache"),
        FAKE_GO_CAPTURE_ENV_FILE: toolEnvRecord,
        FAKE_GO_INVOCATION_LOG: toolInvocationLog,
        FAKE_GO_BUILD_EXIT_CODE: undefined,
        FAKE_GO_BUILD_BARRIER_FILE: undefined,
        FAKE_GO_BUILD_RELEASE_FILE: undefined,
        FAKE_GO_BUILD_CACHE_OBJECT_COUNT: undefined,
        FAKE_GO_BUILD_CACHE_MARKER_VALUE: undefined,
      };
      const request = (effectiveEnv: NodeJS.ProcessEnv = env): string =>
        buildSourcePlugin({
          baseDir: workspace.root,
          cacheDir: toolCache,
          env: effectiveEnv,
          overlayDirs: [],
          pluginName: "source-tool-protocol",
          source: publicNativeProbe.fixtureSource,
          quiet: true,
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
      const priorToolEnv = Object.fromEntries(
        [
          "TTSC_GO_BINARY",
          "TTSC_GO_CACHE_DIR",
          "GOCACHE",
          "FAKE_GO_CAPTURE_ENV_FILE",
        ].map((key) => [key, process.env[key]]),
      );
      try {
        const missingAmbientTool = path.join(
          toolProtocol,
          "missing-ambient-go",
        );
        assert.equal(fs.existsSync(missingAmbientTool), false);
        process.env.TTSC_GO_BINARY = missingAmbientTool;
        process.env.TTSC_GO_CACHE_DIR = path.join(
          toolProtocol,
          "contradictory-go-cache",
        );
        delete process.env.GOCACHE;
        delete process.env.FAKE_GO_CAPTURE_ENV_FILE;
        assert.equal(
          fs.existsSync(request()),
          true,
          "call-local tool must build despite an independently absent ambient tool",
        );
        assert.equal(
          JSON.parse(fs.readFileSync(toolEnvRecord, "utf8")).GOCACHE,
          env.TTSC_GO_CACHE_DIR,
        );
      } finally {
        for (const [key, value] of Object.entries(priorToolEnv)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
      const key = (
        binary: string,
        effectiveEnv: NodeJS.ProcessEnv = env,
      ): string =>
        computeCacheKey({
          dir: replacementModule,
          entry: "./cmd/public-probe",
          env: effectiveEnv,
          goBinary: binary,
          overlayDirs: [],
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
      const toolBytes = fs.readFileSync(tool);
      const relocatedTool = path.join(
        toolProtocol,
        process.platform === "win32" ? "relocated-go.cmd" : "relocated-go",
      );
      fs.copyFileSync(tool, relocatedTool);
      assert.equal(
        key(relocatedTool),
        key(tool),
        "equal executable bytes at another path retain compiler identity",
      );
      fs.appendFileSync(
        tool,
        process.platform === "win32" ? "\r\nrem a\r\n" : "\n# a\n",
      );
      const fixedToolTime = new Date(Math.floor(Date.now() / 1_000) * 1_000);
      fs.utimesSync(tool, fixedToolTime, fixedToolTime);
      const originalToolStat = fs.statSync(tool, { bigint: true });
      const originalToolKey = key(tool);
      fs.writeFileSync(
        tool,
        fs.readFileSync(tool, "utf8").replace(/a(\r?\n)$/, "b$1"),
      );
      fs.utimesSync(tool, fixedToolTime, fixedToolTime);
      assert.equal(
        fs.statSync(tool, { bigint: true }).size,
        originalToolStat.size,
      );
      assert.equal(
        fs.statSync(tool, { bigint: true }).mtimeNs,
        originalToolStat.mtimeNs,
      );
      assert.notEqual(
        key(tool),
        originalToolKey,
        "same-size same-mtime compiler replacement changes identity",
      );
      fs.writeFileSync(tool, toolBytes);
      if (process.platform !== "win32") {
        const cwdCommand = path.join(replacementModule, "go");
        const cwdScript = path.join(replacementModule, "fake-go.cjs");
        assert.equal(fs.existsSync(cwdCommand), false);
        assert.equal(fs.existsSync(cwdScript), false);
        const cwdCreatedCommand = createFakeGoBinary(replacementModule);
        try {
          fs.renameSync(cwdCreatedCommand, cwdCommand);
          const pathToolchain = path.join(toolProtocol, "path-toolchain");
          fs.mkdirSync(pathToolchain);
          fs.renameSync(
            createFakeGoBinary(pathToolchain),
            path.join(pathToolchain, "go"),
          );
          assert.notEqual(
            key("go", { ...env, PATH: `${path.delimiter}${pathToolchain}` }),
            key("go", { ...env, PATH: pathToolchain }),
            "empty leading PATH admits the module-local tool before the PATH-only tool",
          );
        } finally {
          fs.rmSync(cwdCommand, { force: true });
          fs.rmSync(cwdCreatedCommand, { force: true });
          fs.rmSync(cwdScript, { force: true });
        }
      }
      const firstEnvironmentKey = key(tool, {
        ...env,
        FAKE_GO_ENV_GOARM64: "v8.0",
      });
      assert.notEqual(
        key(tool, { ...env, FAKE_GO_ENV_GOARM64: "v9.0" }),
        firstEnvironmentKey,
        "child-reported Go target environment joins identity",
      );
      // Default cache maintenance shares this source and executable. Only its
      // publication state advances; no case-local module is prepared.
      const ownedGoEnv: NodeJS.ProcessEnv = {
        ...env,
        TTSC_CACHE_DIR: "",
        TTSC_GO_CACHE_DIR: "",
        GOCACHE: "",
        GOFLAGS: "-tags=ttsc_owned_go_cache_epoch",
      };
      assert.equal(fs.existsSync(request(ownedGoEnv)), true);
      assert.equal(
        JSON.parse(fs.readFileSync(toolEnvRecord, "utf8")).GOCACHE,
        path.join(toolCache, "go-build"),
        "explicit plugin-cache ownership derives its Go cache beside it",
      );
      const managedEnv: NodeJS.ProcessEnv = {
        ...ownedGoEnv,
        GOFLAGS: "-tags=ttsc_managed_go_cache_epoch",
      };
      const managedCache = path.join(
        workspace.root,
        "node_modules/.cache/ttsc",
      );
      const managedMarker = path.join(managedCache, "go-build/.ttsc-gc");
      const managedRequest = (effectiveEnv: NodeJS.ProcessEnv): string =>
        buildSourcePlugin({
          baseDir: workspace.root,
          env: effectiveEnv,
          overlayDirs: [],
          pluginName: "source-tool-protocol",
          source: publicNativeProbe.fixtureSource,
          quiet: true,
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
      const managedProducer = path.join(nativeProbe.fixtureSource, "probe.go");
      const managedProducerBytes = fs.readFileSync(managedProducer);
      try {
        const successMarker = String(Date.now() + 24 * 60 * 60 * 1000);
        const successful = managedRequest({
          ...managedEnv,
          FAKE_GO_BUILD_CACHE_OBJECT_COUNT: "3",
          FAKE_GO_BUILD_CACHE_MARKER_VALUE: successMarker,
        });
        assert.equal(
          successful.startsWith(path.join(managedCache, "plugins") + path.sep),
          true,
        );
        assert.equal(
          JSON.parse(fs.readFileSync(toolEnvRecord, "utf8")).GOCACHE,
          path.join(managedCache, "go-build"),
        );
        assert.equal(fs.existsSync(managedMarker), true);
        assert.notEqual(
          fs.readFileSync(managedMarker, "utf8").trim(),
          successMarker,
          "managed success enforces maintenance after the build replaces the marker",
        );
        fs.appendFileSync(managedProducer, "\n// managed failure epoch\n");
        const failureMarker = String(Date.now() + 48 * 60 * 60 * 1000);
        assert.throws(
          () =>
            managedRequest({
              ...managedEnv,
              FAKE_GO_BUILD_EXIT_CODE: "17",
              FAKE_GO_BUILD_CACHE_MARKER_VALUE: failureMarker,
            }),
          /source-tool-protocol[\s\S]*fake go: build failed as directed/,
        );
        assert.notEqual(
          fs.readFileSync(managedMarker, "utf8").trim(),
          failureMarker,
          "failed build retains its error while enforcing post-build maintenance",
        );
      } finally {
        fs.writeFileSync(managedProducer, managedProducerBytes);
      }
      const managedPluginRoot = path.join(managedCache, "plugins");
      const managedRootBackup = path.join(
        toolProtocol,
        "managed-plugin-root-backup",
      );
      const outsideCache = path.join(toolProtocol, "outside-cache");
      fs.mkdirSync(outsideCache);
      fs.writeFileSync(path.join(outsideCache, "keep.txt"), "keep\n");
      // Move and restore the existing owner rather than constructing another
      // module/project for each cache alias.
      assert.ok(
        path
          .resolve(managedPluginRoot)
          .startsWith(path.resolve(workspace.root) + path.sep),
      );
      assert.ok(
        path
          .resolve(managedRootBackup)
          .startsWith(path.resolve(workspace.root) + path.sep),
      );
      fs.renameSync(managedPluginRoot, managedRootBackup);
      try {
        fs.symlinkSync(
          outsideCache,
          managedPluginRoot,
          process.platform === "win32" ? "junction" : "dir",
        );
        assert.throws(
          () => managedRequest(managedEnv),
          /unsafe plugin cache root/,
        );
        assert.equal(
          fs.readFileSync(path.join(outsideCache, "keep.txt"), "utf8"),
          "keep\n",
        );
      } finally {
        if (fs.existsSync(managedPluginRoot)) fs.unlinkSync(managedPluginRoot);
        fs.renameSync(managedRootBackup, managedPluginRoot);
      }
      const managedEntry = path.join(managedPluginRoot, key(tool, managedEnv));
      const managedEntryBackup = path.join(
        toolProtocol,
        "managed-entry-backup",
      );
      assert.ok(
        path
          .resolve(managedEntry)
          .startsWith(path.resolve(managedPluginRoot) + path.sep),
      );
      assert.ok(
        path
          .resolve(managedEntryBackup)
          .startsWith(path.resolve(workspace.root) + path.sep),
      );
      assert.equal(fs.existsSync(managedEntry), true);
      fs.renameSync(managedEntry, managedEntryBackup);
      try {
        fs.symlinkSync(
          outsideCache,
          managedEntry,
          process.platform === "win32" ? "junction" : "dir",
        );
        assert.throws(
          () => managedRequest(managedEnv),
          /unsafe plugin cache entry/,
        );
        assert.equal(
          fs.readFileSync(path.join(outsideCache, "keep.txt"), "utf8"),
          "keep\n",
        );
      } finally {
        if (fs.existsSync(managedEntry)) fs.unlinkSync(managedEntry);
      }
      try {
        for (const protocol of ["legacy", "v2", "v3"] as const) {
          const outsideLock = path.join(
            toolProtocol,
            `outside-${protocol}-lock`,
          );
          const lock =
            managedEntry +
            ".lock" +
            (protocol === "legacy" ? "" : `.${protocol}`);
          const lockBackup = path.join(
            toolProtocol,
            `managed-${protocol}-lock-backup`,
          );
          assert.ok(
            path
              .resolve(lock)
              .startsWith(path.resolve(managedPluginRoot) + path.sep),
          );
          assert.equal(
            path.dirname(path.resolve(lockBackup)),
            path.resolve(toolProtocol),
          );
          assert.equal(fs.existsSync(lockBackup), false);
          const existingLock = fs.existsSync(lock);
          if (existingLock) {
            assert.equal(
              fs.lstatSync(lock).isSymbolicLink(),
              false,
              "preserve the actual coordination owner, not an external alias",
            );
            assert.equal(fs.statSync(lock).isDirectory(), true);
          }
          fs.mkdirSync(outsideLock);
          fs.writeFileSync(path.join(outsideLock, "keep.txt"), "keep\n");
          if (protocol === "legacy") {
            const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
            fs.utimesSync(outsideLock, old, old);
          } else {
            fs.mkdirSync(path.join(outsideLock, "retired"));
            fs.writeFileSync(
              path.join(outsideLock, `protocol-${protocol}`),
              `ttsc-plugin-build-lock-${protocol}\n`,
            );
          }
          const outsideEntries = fs.readdirSync(outsideLock).sort();
          let preservedLock = false;
          try {
            if (existingLock) {
              fs.renameSync(lock, lockBackup);
              preservedLock = true;
            }
            fs.symlinkSync(
              outsideLock,
              lock,
              process.platform === "win32" ? "junction" : "dir",
            );
            if (protocol === "v2")
              assert.equal(fs.existsSync(managedRequest(managedEnv)), true);
            else assert.throws(() => managedRequest(managedEnv));
            assert.deepEqual(
              fs.readdirSync(outsideLock).sort(),
              outsideEntries,
              `${protocol} lock cannot mutate its external target`,
            );
            if (protocol !== "legacy")
              assert.deepEqual(
                fs.readdirSync(path.join(outsideLock, "retired")),
                [],
              );
          } finally {
            assert.ok(
              path
                .resolve(lock)
                .startsWith(path.resolve(managedPluginRoot) + path.sep),
            );
            if ((!existingLock || preservedLock) && fs.existsSync(lock)) {
              if (fs.lstatSync(lock).isSymbolicLink()) fs.unlinkSync(lock);
              else fs.rmSync(lock, { recursive: true });
            }
            if (fs.existsSync(managedEntry))
              fs.rmSync(managedEntry, { recursive: true });
            if (preservedLock) fs.renameSync(lockBackup, lock);
          }
        }
      } finally {
        fs.renameSync(managedEntryBackup, managedEntry);
      }
      // The already executing scripted compiler changes/restores its selected
      // executable during this build. No separate editor process is required.
      const scriptFile = path.join(toolProtocol, "fake-go.cjs");
      const stableScript = fs.readFileSync(scriptFile, "utf8");
      const raceToolBytes = fs.readFileSync(tool);
      const raceToolTime = fs.statSync(tool).mtimeMs;
      const raceEnv = { ...env, GOFLAGS: "-tags=ttsc_toolchain_witness_epoch" };
      const raceEntry = path.join(toolCache, "plugins", key(tool, raceEnv));
      const cachedRaceBinaries = () =>
        fs.existsSync(raceEntry)
          ? fs
              .readdirSync(raceEntry, { recursive: true })
              .map(String)
              .filter((name) => /plugin(\.exe)?$/.test(name))
          : [];
      assert.deepEqual(cachedRaceBinaries(), []);
      const raceBody = [
        `const selectedTool = ${JSON.stringify(tool)};`,
        "const selectedBytes = fs.readFileSync(selectedTool);",
        'fs.writeFileSync(selectedTool, Buffer.concat([selectedBytes, Buffer.from("\\n")]));',
        "fs.writeFileSync(selectedTool, selectedBytes);",
        `fs.utimesSync(selectedTool, new Date(${raceToolTime + 1000}), new Date(${raceToolTime + 1000}));`,
      ].join("\n");
      try {
        assert.equal(
          stableScript.includes(
            "if (process.env.FAKE_GO_BUILD_BARRIER_FILE) {",
          ),
          true,
        );
        fs.writeFileSync(
          scriptFile,
          stableScript.replace(
            "if (process.env.FAKE_GO_BUILD_BARRIER_FILE) {",
            raceBody + "\nif (process.env.FAKE_GO_BUILD_BARRIER_FILE) {",
          ),
        );
        assert.throws(
          () => request(raceEnv),
          /Go toolchain of plugin "source-tool-protocol" changed while it was being built/,
        );
        assert.deepEqual(
          fs.readFileSync(tool),
          raceToolBytes,
          "restoring bytes cannot retrospectively authorize the changed tool witness",
        );
        assert.deepEqual(
          cachedRaceBinaries(),
          [],
          "the raced build must not publish a binary",
        );
      } finally {
        fs.writeFileSync(scriptFile, stableScript);
        fs.writeFileSync(tool, raceToolBytes);
      }
      assert.equal(
        fs.existsSync(request(raceEnv)),
        true,
        "an unchanged subsequent build publishes the same epoch",
      );
      const overlay = path.join(toolProtocol, "overlay");
      fs.cpSync(replacementFixture, overlay, { recursive: true });
      const overlayFile = path.join(overlay, "dep.go");
      const overlayOriginal = fs.readFileSync(overlayFile, "utf8");
      const overlayFirst = overlayOriginal + "// FIRST\n";
      const overlaySecond = overlayOriginal + "// SECOND\n";
      fs.writeFileSync(overlayFile, overlayFirst);
      const overlayEnv = {
        ...env,
        GOFLAGS: "-tags=ttsc_overlay_witness_epoch",
      };
      const overlayRequest = () =>
        buildSourcePlugin({
          baseDir: workspace.root,
          cacheDir: toolCache,
          env: overlayEnv,
          overlayDirs: [overlay],
          pluginName: "source-tool-protocol",
          source: publicNativeProbe.fixtureSource,
          quiet: true,
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
      const overlayOutput = [
        'const usedOverlay = fs.readFileSync("go.work", "utf8").split(/\\r?\\n/).map((line) => line.trim().replace(/^"|"$/g, "")).find((entry) => path.basename(entry) === "overlay");',
        `fs.writeFileSync(${JSON.stringify(overlayFile)}, ${JSON.stringify(overlaySecond)});`,
        'fs.writeFileSync(out, fs.readFileSync(path.join(usedOverlay, "dep.go"), "utf8"));',
      ].join("\n");
      let overlayBinary: string;
      try {
        fs.writeFileSync(
          scriptFile,
          stableScript.replace(
            'fs.writeFileSync(out, "fake plugin binary\\n", "utf8");',
            overlayOutput,
          ),
        );
        overlayBinary = overlayRequest();
        assert.equal(
          fs.readFileSync(overlayBinary, "utf8"),
          overlayFirst,
          "actual go.work selects the proven copied overlay despite original mutation during build",
        );
        assert.equal(fs.readFileSync(overlayFile, "utf8"), overlaySecond);
        assert.equal(
          fs
            .readdirSync(path.dirname(overlayBinary), { recursive: true })
            .map(String)
            .filter((name) => /plugin(\.exe)?$/.test(name)).length,
          1,
          "the overlay state publishes one copied artifact alongside the distinct preceding epochs",
        );
        fs.writeFileSync(overlayFile, overlayFirst);
        assert.equal(
          overlayRequest(),
          overlayBinary,
          "restoring the overlay selects the already compiled copied state",
        );
      } finally {
        fs.writeFileSync(scriptFile, stableScript);
      }
      const workspaceOverlayFixture = path.join(
        TestProject.WORKSPACE_ROOT,
        "packages/unplugin/test/fixtures/source-workspace-overlays",
      );
      const spacedWorkspaceOverlay = path.join(toolProtocol, "space dir/ttsc");
      const bareWorkspaceOverlay = path.join(toolProtocol, "nospace/shim");
      const commentWorkspaceBase = path.join(
        toolProtocol,
        "comment-prefix/shim",
      );
      for (const [input, destination] of [
        ["ttsc", spacedWorkspaceOverlay],
        ["shim", bareWorkspaceOverlay],
        ["comment-prefix", commentWorkspaceBase],
      ] as const)
        fs.cpSync(path.join(workspaceOverlayFixture, input), destination, {
          recursive: true,
        });
      const commentWorkspaceOverlay =
        process.platform === "win32"
          ? path.toNamespacedPath(commentWorkspaceBase)
          : "/" + commentWorkspaceBase;
      const capturedWorkspace = path.join(
        toolProtocol,
        "quoted-workspace.work",
      );
      const captureWorkspace = `fs.copyFileSync("go.work", ${JSON.stringify(capturedWorkspace)});\n`;
      try {
        fs.writeFileSync(
          scriptFile,
          stableScript.replace(
            'fs.writeFileSync(out, "fake plugin binary\\n", "utf8");',
            captureWorkspace +
              'fs.writeFileSync(out, "fake plugin binary\\n", "utf8");',
          ),
        );
        buildSourcePlugin({
          baseDir: workspace.root,
          cacheDir: toolCache,
          env: { ...env, GOFLAGS: "-tags=ttsc_workspace_quote_epoch" },
          overlayDirs: [
            spacedWorkspaceOverlay,
            bareWorkspaceOverlay,
            commentWorkspaceOverlay,
          ],
          pluginName: "source-tool-protocol",
          source: publicNativeProbe.fixtureSource,
          quiet: true,
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
        const text = fs.readFileSync(capturedWorkspace, "utf8");
        const uses = text
          .split(/\r?\n/)
          .filter((line) => /^\t/.test(line))
          .map((line) => line.trim());
        const spacedUse = uses.find((line) => line.endsWith('space dir/ttsc"'));
        const bareUse = uses.find((line) => line.endsWith("nospace/shim"));
        const commentUse = uses.find((line) =>
          line.replace(/^"|"$/g, "").endsWith("comment-prefix/shim"),
        );
        assert.ok(spacedUse?.startsWith('"'), text);
        assert.ok(bareUse && !bareUse.startsWith('"'), text);
        assert.ok(commentUse, text);
        assert.equal(
          text.includes(
            `replace github.com/samchon/ttsc/packages/ttsc v0.0.0 => ${spacedUse}`,
          ),
          true,
          text,
        );
        const parsed = TestProject.spawn("go", ["work", "edit", "-json"], {
          cwd: toolProtocol,
          env: { GOWORK: capturedWorkspace },
        });
        if (parsed.error) throw parsed.error;
        assert.equal(parsed.signal, null);
        assert.equal(parsed.status, 0, parsed.stderr || parsed.stdout);
        const parsedWorkspace = JSON.parse(parsed.stdout) as {
          Use?: { DiskPath?: string }[];
        };
        assert.equal(
          parsedWorkspace.Use?.some(
            (entry) => entry.DiskPath === commentUse.replace(/^"|"$/g, ""),
          ),
          true,
          parsed.stdout,
        );
      } finally {
        fs.writeFileSync(scriptFile, stableScript);
      }
      const keyRaceManifest = path.join(replacementModule, "go.mod");
      const keyRaceProducer = path.join(nativeProbe.fixtureSource, "probe.go");
      const keyRaceManifestBytes = fs.readFileSync(keyRaceManifest);
      const keyRaceProducerBytes = fs.readFileSync(keyRaceProducer);
      const keyRaceMarker = path.join(toolProtocol, "source-key-edit.marker");
      const keyEdit = [
        'if (args[0] === "mod" && args[1] === "edit" && args[2] === "-json") {',
        `  if (!fs.existsSync(${JSON.stringify(keyRaceMarker)})) {`,
        `    fs.appendFileSync(${JSON.stringify(keyRaceProducer)}, "\\n// edited after keyed digest\\n");`,
        `    fs.writeFileSync(${JSON.stringify(keyRaceMarker)}, "edited\\n");`,
        "  }",
        "}",
      ].join("\n");
      try {
        // This comment exercises the actual Go reader after the source digest;
        // it supplies no replacement directive or new authored module.
        fs.appendFileSync(keyRaceManifest, "\n// replace nothing\n");
        fs.appendFileSync(keyRaceProducer, "\n// source key race epoch\n");
        const modRead =
          'if (args[0] === "mod" && args[1] === "edit" && args[2] === "-json") {';
        assert.equal(stableScript.includes(modRead), true);
        fs.writeFileSync(
          scriptFile,
          stableScript.replace(modRead, keyEdit + "\n" + modRead),
        );
        assert.throws(
          () => overlayRequest(),
          (error: unknown) =>
            error instanceof Error &&
            error.message.includes(
              `source ${replacementModule} changed while it was being built`,
            ),
        );
        assert.equal(fs.readFileSync(keyRaceMarker, "utf8"), "edited\n");
      } finally {
        fs.writeFileSync(scriptFile, stableScript);
        fs.writeFileSync(keyRaceManifest, keyRaceManifestBytes);
        fs.writeFileSync(keyRaceProducer, keyRaceProducerBytes);
      }
      // Actual OS delivery advances the same tool owner; no standalone project.
      try {
        const failures: Error[] = [];
        const spawnSync = E2eProcessTrace.spawnSync;
        const attempts: Array<{
          binary: string;
          args: readonly string[];
          cwd: string | URL | undefined;
        }> = [];
        let nativeReferenceAttempted = false;
        let cleanupCompleted = false;
        const receipts: Array<{
          binary: string;
          args: readonly string[];
          status: number | null;
          pid: number;
          missing: boolean;
          syntheticMissingCandidate: boolean;
        }> = [];
        let operation = "fixture setup";
        const collectOsAssertion = (
          verify: () => void,
          identity: string,
        ): void => {
          try {
            verify();
          } catch (cause) {
            failures.push(new Error(identity + ": " + operation, { cause }));
          }
        };
        const spawnGoTool: typeof actualSpawnGoTool = (
          binary,
          args,
          options,
        ) => {
          operation = JSON.stringify({ binary, args, cwd: options.cwd });
          attempts.push({ binary, args: [...args], cwd: options.cwd });
          const result = actualSpawnGoTool(binary, args, options);
          const missing =
            (result.error as NodeJS.ErrnoException | undefined)?.code ===
            "ENOENT";
          receipts.push({
            binary,
            args: [...args],
            status: result.status,
            pid: result.pid,
            missing,
            syntheticMissingCandidate:
              process.platform === "win32" &&
              missing &&
              /\.(?:cmd|bat)$/i.test(binary),
          });
          return result;
        };
        let wrapperMatrixFinished = process.platform !== "win32";
        let nativeMissingMatrixFinished = false;
        const root = path.join(toolProtocol, "native-tool-os");
        assert.equal(fs.existsSync(root), false);
        fs.mkdirSync(root);
        const reportRoot = toolProtocol;
        try {
          try {
            if (process.platform === "win32") {
              const wrapperRoot = path.join(
                root,
                "%TTSC_GO_EXPANDS% literal %% & (parentheses) ^ caret !TTSC_GO_DELAYED!",
              );
              fs.mkdirSync(wrapperRoot, { recursive: true });
              const capture = path.join(root, "argv.jsonl");
              const script = path.join(wrapperRoot, "capture.cjs");
              fs.copyFileSync(
                path.join(
                  workspace.root,
                  "tools/native-tool-capture/capture.cjs",
                ),
                script,
              );
              const wrapper = path.join(wrapperRoot, "go.cmd");
              fs.writeFileSync(
                wrapper,
                `@echo off\r\n"%TTSC_GO_TEST_NODE%" "%~dp0capture.cjs" %*\r\n`,
                "utf8",
              );
              const commands = [
                ["version"],
                [
                  "env",
                  "-json",
                  "GOOS",
                  "%SET_VALUE%",
                  "%%",
                  "%",
                  "%UNKNOWN%",
                  "!SET_VALUE!",
                  "!",
                  "!UNKNOWN!",
                ],
                ["mod", "edit", "-json", "space value", "&", "(value)", "^"],
                [
                  "build",
                  "-o",
                  path.join(wrapperRoot, '%OUTPUT% & "quoted" \\'),
                  ".",
                ],
              ];
              const env: NodeJS.ProcessEnv = {
                ...process.env,
                TTSC_GO_ARGV_CAPTURE: capture,
                TTSC_GO_CALLER_SENTINEL: "preserved",
                TTSC_GO_DELAYED: "WRONG_DIRECTORY",
                TTSC_GO_EXPANDS: "WRONG_DIRECTORY",
                TTSC_GO_TEST_NODE: process.execPath,
                TTSC_GO_METADATA_BINARY: resolveGoCompiler({
                  ...process.env,
                  TTSC_GO_BINARY: "",
                }).binary,
                SET_VALUE: "WRONG_ARGUMENT",
              };
              for (const args of commands) {
                const result = spawnGoTool(wrapper, args, {
                  encoding: "utf8",
                  env,
                  windowsHide: true,
                });
                collectOsAssertion(
                  () =>
                    assert.equal(
                      result.status,
                      0,
                      result.stderr || result.error?.message,
                    ),
                  "original OS assertion line 94",
                );
              }
              const lookupArgs = ["env", "PATH lookup", "%LOOKUP%", "!LOOKUP!"];
              const lookupResult = spawnGoTool("go", lookupArgs, {
                cwd: root,
                encoding: "utf8",
                env: { ...env, PATH: wrapperRoot, PATHEXT: ".EXE;.CMD" },
                windowsHide: true,
              });
              collectOsAssertion(
                () =>
                  assert.equal(
                    lookupResult.status,
                    0,
                    lookupResult.stderr || lookupResult.error?.message,
                  ),
                "original OS assertion line 104",
              );
              const relativeArgs = ["version", "relative wrapper"];
              const relativeResult = spawnGoTool(".\\go.cmd", relativeArgs, {
                cwd: wrapperRoot,
                encoding: "utf8",
                env,
                windowsHide: true,
              });
              collectOsAssertion(
                () =>
                  assert.equal(
                    relativeResult.status,
                    0,
                    relativeResult.stderr || relativeResult.error?.message,
                  ),
                "original OS assertion line 117",
              );
              const whitespaceRoot = path.join(root, " leading-path-entry");
              fs.mkdirSync(whitespaceRoot, { recursive: true });
              fs.copyFileSync(script, path.join(whitespaceRoot, "capture.cjs"));
              fs.copyFileSync(wrapper, path.join(whitespaceRoot, "go.cmd"));
              const whitespaceArgs = ["version", "literal PATH whitespace"];
              const whitespaceResult = spawnGoTool("go", whitespaceArgs, {
                cwd: root,
                encoding: "utf8",
                env: { ...env, PATH: " leading-path-entry", PATHEXT: ".CMD" },
                windowsHide: true,
              });
              collectOsAssertion(
                () =>
                  assert.equal(
                    whitespaceResult.status,
                    0,
                    whitespaceResult.stderr || whitespaceResult.error?.message,
                  ),
                "original OS assertion line 134",
              );
              const semicolonRoot = path.join(root, "quoted;path-entry");
              fs.mkdirSync(semicolonRoot, { recursive: true });
              fs.copyFileSync(script, path.join(semicolonRoot, "capture.cjs"));
              fs.copyFileSync(wrapper, path.join(semicolonRoot, "go.cmd"));
              const semicolonArgs = ["version", "quoted semicolon PATH"];
              const semicolonResult = spawnGoTool("go", semicolonArgs, {
                cwd: root,
                encoding: "utf8",
                env: { ...env, PATH: `"${semicolonRoot}"`, PATHEXT: ".CMD" },
                windowsHide: true,
              });
              collectOsAssertion(
                () =>
                  assert.equal(
                    semicolonResult.status,
                    0,
                    semicolonResult.stderr || semicolonResult.error?.message,
                  ),
                "original OS assertion line 151",
              );
              const singleQuoteArgs = [
                "version",
                "single-quoted semicolon PATH",
              ];
              const singleQuoteResult = spawnGoTool("go", singleQuoteArgs, {
                cwd: root,
                encoding: "utf8",
                env: { ...env, PATH: `'${semicolonRoot}'`, PATHEXT: ".CMD" },
                windowsHide: true,
              });
              collectOsAssertion(
                () =>
                  assert.equal(
                    singleQuoteResult.status,
                    0,
                    singleQuoteResult.stderr ||
                      singleQuoteResult.error?.message,
                  ),
                "original OS assertion line 163",
              );
              fs.copyFileSync(wrapper, path.join(wrapperRoot, "node.cmd"));
              const nativeMarker = path.join(root, "native-selected.txt");
              const nativeResult = spawnGoTool(
                "node",
                [
                  "-e",
                  'require("node:fs").writeFileSync(process.env.TTSC_GO_NATIVE_MARKER, "native")',
                ],
                {
                  cwd: wrapperRoot,
                  encoding: "utf8",
                  env: {
                    ...env,
                    PATH: path.dirname(process.execPath),
                    PATHEXT: ".CMD;.EXE",
                    TTSC_GO_NATIVE_MARKER: nativeMarker,
                  },
                  windowsHide: true,
                },
              );
              collectOsAssertion(
                () =>
                  assert.equal(
                    nativeResult.status,
                    0,
                    nativeResult.stderr || nativeResult.error?.message,
                  ),
                "original OS assertion line 189",
              );
              collectOsAssertion(
                () =>
                  assert.equal(fs.readFileSync(nativeMarker, "utf8"), "native"),
                "original OS assertion line 194",
              );
              const blockedRoot = path.join(root, "blocked-current-directory");
              fs.mkdirSync(blockedRoot, { recursive: true });
              fs.writeFileSync(
                path.join(blockedRoot, "go.cmd"),
                "@exit /b 91\r\n",
              );
              const noCwdArgs = ["version", "skip current directory"];
              const noDefaultCurrentDirectory =
                process.env.NoDefaultCurrentDirectoryInExePath;
              try {
                delete process.env.NoDefaultCurrentDirectoryInExePath;
                const childPolicyResult = spawnGoTool("go", ["version"], {
                  cwd: blockedRoot,
                  encoding: "utf8",
                  env: {
                    ...env,
                    NoDefaultCurrentDirectoryInExePath: "1",
                    PATH: `"${semicolonRoot}"`,
                    PATHEXT: ".CMD",
                  },
                  windowsHide: true,
                });
                collectOsAssertion(
                  () =>
                    assert.equal(
                      childPolicyResult.status,
                      91,
                      "the child environment must not disable libuv's parent cwd probe",
                    ),
                  "original OS assertion line 215",
                );
                process.env.NoDefaultCurrentDirectoryInExePath = "1";
                const noCwdResult = spawnGoTool("go", noCwdArgs, {
                  cwd: blockedRoot,
                  encoding: "utf8",
                  env: {
                    ...env,
                    PATH: `"${semicolonRoot}"`,
                    PATHEXT: ".CMD",
                  },
                  windowsHide: true,
                });
                collectOsAssertion(
                  () =>
                    assert.equal(
                      noCwdResult.status,
                      0,
                      noCwdResult.stderr || noCwdResult.error?.message,
                    ),
                  "original OS assertion line 232",
                );
                const quotedEmptyResult = spawnGoTool("go", ["version"], {
                  cwd: blockedRoot,
                  encoding: "utf8",
                  env: {
                    ...env,
                    PATH: `"";"${semicolonRoot}"`,
                    PATHEXT: ".CMD",
                  },
                  windowsHide: true,
                });
                collectOsAssertion(
                  () =>
                    assert.equal(
                      quotedEmptyResult.status,
                      91,
                      "a quoted-empty PATH entry must explicitly select cwd",
                    ),
                  "original OS assertion line 247",
                );
              } finally {
                if (noDefaultCurrentDirectory === undefined) {
                  delete process.env.NoDefaultCurrentDirectoryInExePath;
                } else {
                  process.env.NoDefaultCurrentDirectoryInExePath =
                    noDefaultCurrentDirectory;
                }
              }
              const envWithoutPath: NodeJS.ProcessEnv = {
                ...env,
                PATHEXT: ".CMD",
              };
              for (const key of Object.keys(envWithoutPath)) {
                if (key.toLowerCase() === "path") delete envWithoutPath[key];
              }
              const parentPath = process.env.PATH;
              const inheritedPathArgs = ["version", "inherited PATH"];
              try {
                process.env.PATH = whitespaceRoot;
                const inheritedPathResult = spawnGoTool(
                  "go",
                  inheritedPathArgs,
                  {
                    cwd: root,
                    encoding: "utf8",
                    env: envWithoutPath,
                    windowsHide: true,
                  },
                );
                collectOsAssertion(
                  () =>
                    assert.equal(
                      inheritedPathResult.status,
                      0,
                      inheritedPathResult.stderr ||
                        inheritedPathResult.error?.message,
                    ),
                  "original OS assertion line 275",
                );
              } finally {
                if (parentPath === undefined) delete process.env.PATH;
                else process.env.PATH = parentPath;
              }
              const duplicatePathArgs = ["version", "duplicate PATH casing"];
              const duplicatePathResult = spawnGoTool("go", duplicatePathArgs, {
                cwd: root,
                encoding: "utf8",
                env: {
                  ...envWithoutPath,
                  Path: `"${semicolonRoot}"`,
                  path: blockedRoot,
                },
                windowsHide: true,
              });
              collectOsAssertion(
                () =>
                  assert.equal(
                    duplicatePathResult.status,
                    0,
                    duplicatePathResult.stderr ||
                      duplicatePathResult.error?.message,
                  ),
                "original OS assertion line 296",
              );
              const plugin = path.join(root, "plugin");
              const relativeToolchainA = path.join(
                plugin,
                "relative-toolchain-a",
              );
              const relativeToolchainB = path.join(
                plugin,
                "relative-toolchain-b",
              );
              fs.mkdirSync(relativeToolchainA, { recursive: true });
              fs.mkdirSync(relativeToolchainB, { recursive: true });
              fs.cpSync(replacementFixture, plugin, { recursive: true });
              // This matrix proves tool identity and argv transport, not Go's
              // replacement parser. A replacement-named module would trigger
              // that independent metadata query even for the intentionally
              // non-Go executable used by the extended-name identity contrast.
              fs.writeFileSync(
                path.join(plugin, "go.mod"),
                "module example.com/native-tool-identity\n\ngo 1.26\n",
              );
              for (const toolchain of [
                relativeToolchainA,
                relativeToolchainB,
              ]) {
                fs.copyFileSync(script, path.join(toolchain, "capture.cjs"));
              }
              fs.writeFileSync(
                path.join(relativeToolchainA, "go.cmd"),
                `@echo off\r\nrem compiler a\r\n"%TTSC_GO_TEST_NODE%" "%~dp0capture.cjs" %*\r\n`,
                "utf8",
              );
              fs.writeFileSync(
                path.join(relativeToolchainB, "go.cmd"),
                `@echo off\r\nrem compiler b\r\n"%TTSC_GO_TEST_NODE%" "%~dp0capture.cjs" %*\r\n`,
                "utf8",
              );
              const keyA = computeCacheKey({
                dir: plugin,
                entry: ".",
                env: {
                  ...env,
                  PATH: "relative-toolchain-a",
                  PATHEXT: ".CMD",
                },
                goBinary: "go",
                ttscVersion: "1.0.0",
                tsgoVersion: "7.0.0-dev",
              });
              const keyB = computeCacheKey({
                dir: plugin,
                entry: ".",
                env: {
                  ...env,
                  PATH: "relative-toolchain-b",
                  PATHEXT: ".CMD",
                },
                goBinary: "go",
                ttscVersion: "1.0.0",
                tsgoVersion: "7.0.0-dev",
              });
              collectOsAssertion(
                () => assert.notEqual(keyA, keyB),
                "original OS assertion line 350",
              );
              const nativeTemplate = path.join(
                process.env.SystemRoot ?? "C:\\Windows",
                "System32",
                "where.exe",
              );
              const extendedNativeA = path.join(root, "extended-native-a");
              const extendedNativeB = path.join(root, "extended-native-b");
              fs.mkdirSync(extendedNativeA, { recursive: true });
              fs.mkdirSync(extendedNativeB, { recursive: true });
              const goV1A = path.join(extendedNativeA, "go.v1.exe");
              const goV1B = path.join(extendedNativeB, "go.v1.exe");
              fs.copyFileSync(nativeTemplate, goV1A);
              fs.copyFileSync(nativeTemplate, goV1B);
              fs.appendFileSync(goV1A, "compiler a");
              fs.appendFileSync(goV1B, "compiler b");
              const extendedKeyA = computeCacheKey({
                dir: plugin,
                entry: ".",
                env: { ...env, PATH: extendedNativeA },
                goBinary: "go.v1",
                ttscVersion: "1.0.0",
                tsgoVersion: "7.0.0-dev",
              });
              const extendedKeyB = computeCacheKey({
                dir: plugin,
                entry: ".",
                env: { ...env, PATH: extendedNativeB },
                goBinary: "go.v1",
                ttscVersion: "1.0.0",
                tsgoVersion: "7.0.0-dev",
              });
              collectOsAssertion(
                () => assert.notEqual(extendedKeyA, extendedKeyB),
                "original OS assertion line 383",
              );
              for (const missing of [
                "missing-go",
                "missing-go.cmd",
                ".\\missing-go.cmd",
              ]) {
                const result = spawnGoTool(missing, ["version"], {
                  cwd: root,
                  encoding: "utf8",
                  env: { ...env, PATH: root, PATHEXT: ".CMD" },
                  windowsHide: true,
                });
                collectOsAssertion(
                  () =>
                    assert.equal(
                      (result.error as NodeJS.ErrnoException | undefined)?.code,
                      "ENOENT",
                    ),
                  "original OS assertion line 396",
                );
              }
              operation = "capture transcript and caller environment";
              const captured = fs
                .readFileSync(capture, "utf8")
                .trim()
                .split(/\r?\n/)
                .map(
                  (line) =>
                    JSON.parse(line) as {
                      args: string[];
                      sentinel: string | undefined;
                    },
                );
              const expectedArgs = [
                ...commands,
                lookupArgs,
                relativeArgs,
                whitespaceArgs,
                semicolonArgs,
                singleQuoteArgs,
                noCwdArgs,
                inheritedPathArgs,
                duplicatePathArgs,
              ];
              collectOsAssertion(
                () =>
                  assert.deepEqual(
                    captured
                      .slice(0, expectedArgs.length)
                      .map(({ args }) => args),
                    expectedArgs,
                  ),
                "original OS assertion line 421",
              );
              collectOsAssertion(
                () => assert.equal(captured.length, expectedArgs.length + 4),
                "original OS assertion line 425",
              );
              for (
                let index = expectedArgs.length;
                index < captured.length;
                index += 2
              ) {
                collectOsAssertion(
                  () => assert.deepEqual(captured[index]?.args, ["version"]),
                  "original OS assertion line 427",
                );
                collectOsAssertion(
                  () =>
                    assert.deepEqual(captured[index + 1]?.args.slice(0, 2), [
                      "env",
                      "-json",
                    ]),
                  "original OS assertion line 428",
                );
              }
              collectOsAssertion(
                () =>
                  assert.ok(
                    captured.every(({ sentinel }) => sentinel === "preserved"),
                  ),
                "original OS assertion line 430",
              );
              collectOsAssertion(
                () =>
                  assert.equal(
                    Object.keys(env).some((key) =>
                      key.startsWith("TTSC_GO_COMMAND_SHIM_"),
                    ),
                    false,
                    "the caller's environment object must not be mutated",
                  ),
                "original OS assertion line 431",
              );
            }
            wrapperMatrixFinished = true;
          } catch (cause) {
            failures.push(
              new Error("Windows wrapper fixture or capture", { cause }),
            );
          }
          try {
            operation = "native ENOENT reference";
            nativeReferenceAttempted = true;
            const native = spawnSync(
              path.join(root, "absent-native"),
              ["version"],
              {
                encoding: "utf8",
                windowsHide: true,
              },
            );
            const nativeError = native.error as
              | NodeJS.ErrnoException
              | undefined;
            collectOsAssertion(
              () => assert.equal(nativeError?.code, "ENOENT"),
              "original OS assertion line 442",
            );
            const missing =
              process.platform === "win32"
                ? [
                    "missing-go",
                    "missing-go.cmd",
                    "missing-go.bat",
                    "MISSING-GO.CMD",
                    "missing-go.BAT",
                    ".\\missing-go.cmd",
                    path.join(root, "missing-go.cmd"),
                    path.join(root, "missing-go.bat"),
                  ]
                : ["missing-go", path.join(root, "missing-go")];
            for (const binary of missing) {
              const result = spawnGoTool(binary, ["version"], {
                cwd: root,
                encoding: "utf8",
                env: {
                  ...process.env,
                  PATH: root,
                  PATHEXT: ".COM;.EXE;.BAT;.CMD",
                },
                windowsHide: true,
              });
              const error = result.error as NodeJS.ErrnoException | undefined;
              collectOsAssertion(
                () => assert.equal(error?.code, "ENOENT", binary),
                "original OS assertion line 465",
              );
              collectOsAssertion(
                () => assert.equal(error?.errno, nativeError?.errno, binary),
                "original OS assertion line 466",
              );
              collectOsAssertion(
                () =>
                  assert.equal(error?.syscall, `spawnSync ${binary}`, binary),
                "original OS assertion line 467",
              );
              collectOsAssertion(
                () => assert.equal(error?.path, binary, binary),
                "original OS assertion line 468",
              );
              collectOsAssertion(
                () =>
                  assert.deepEqual(
                    (
                      error as
                        | {
                            spawnargs?: string[];
                          }
                        | undefined
                    )?.spawnargs,
                    ["version"],
                    binary,
                  ),
                "original OS assertion line 469",
              );
              collectOsAssertion(
                () => assert.equal(result.status, null, binary),
                "original OS assertion line 474",
              );
              collectOsAssertion(
                () => assert.equal(result.pid, native.pid, binary),
                "original OS assertion line 475",
              );
            }
            nativeMissingMatrixFinished = true;
          } catch (cause) {
            failures.push(
              new Error("native missing-process matrix", { cause }),
            );
          }
        } finally {
          try {
            const temporaryRoot = fs.realpathSync.native(toolProtocol);
            const ownedRoot = fs.realpathSync.native(root);
            const relative = path.relative(temporaryRoot, ownedRoot);
            if (
              relative === "" ||
              relative === ".." ||
              relative.startsWith(".." + path.sep) ||
              path.isAbsolute(relative)
            )
              throw new Error(
                "OS corpus cleanup target is outside its owned temporary root",
              );
            fs.rmSync(ownedRoot, { recursive: true, force: true });
            assert.equal(
              fs.existsSync(ownedRoot),
              false,
              "owned OS corpus root is removed",
            );
            cleanupCompleted = true;
          } catch (cause) {
            failures.push(new Error("OS corpus final cleanup", { cause }));
          }
        }
        const report = {
          platform: process.platform,
          outcome:
            !wrapperMatrixFinished ||
            !nativeMissingMatrixFinished ||
            !cleanupCompleted
              ? "BLOCKED"
              : failures.length !== 0
                ? "FAIL"
                : "PASS",
          wrapperMatrixExecuted: process.platform === "win32",
          wrapperMatrixFinished,
          cleanupCompleted,
          directAttemptedRequests: attempts.length,
          attempts,
          nativeMissingMatrixFinished,
          directToolRequests: receipts.length,
          directReturnedPositivePidResults: receipts.filter(
            (receipt) => receipt.pid > 0,
          ).length,
          directMissingResults: receipts.filter((receipt) => receipt.missing)
            .length,
          syntheticMissingCandidates: receipts.filter(
            (receipt) => receipt.syntheticMissingCandidate,
          ).length,
          receipts,
          metadataRequestsFromCurrentCalleePlan:
            process.platform === "win32" ? 8 : 0,
          nativeMissingReferenceRequests: Number(nativeReferenceAttempted),
          countBoundary:
            "Direct requests/returned positive PID results are observed, not distinct actual launch events. Nested metadata cardinality is a static callee plan, not an OS process trace; broker/inner attempts and descendants require separate observations.",
          failures: failures.map((failure) => ({
            identity: failure.message,
            cause: String(failure.cause),
          })),
        };
        try {
          fs.writeFileSync(
            path.join(reportRoot, "native-tool-os.json"),
            JSON.stringify(report, null, 2) + "\n",
            "utf8",
          );
        } catch (cause) {
          failures.push(new Error("OS corpus report write", { cause }));
        }
        if (failures.length !== 0)
          throw new AggregateError(failures, "native Go-tool OS corpus failed");
      } catch (cause) {
        publicApiFailures.push(
          new Error("native tool OS delivery population", { cause }),
        );
      }
      const linkedInput = path.join(
        replacementModule,
        "tool-owned-linked-source",
      );
      const excludedLink = path.join(
        replacementModule,
        "node_modules/tool-owned-linked-source",
      );
      const linkedTarget = path.join(toolProtocol, "linked-source");
      assert.equal(fs.existsSync(linkedInput), false);
      assert.equal(fs.existsSync(excludedLink), false);
      fs.mkdirSync(linkedTarget);
      fs.copyFileSync(
        path.join(replacementFixture, "dep.go"),
        path.join(linkedTarget, "shared.go"),
      );
      const buildInvocations = () =>
        fs
          .readFileSync(toolInvocationLog, "utf8")
          .split(/\r?\n/)
          .filter((line) => line.startsWith("build"));
      const beforeLinkBuilds = buildInvocations();
      try {
        fs.symlinkSync(
          linkedTarget,
          linkedInput,
          process.platform === "win32" ? "junction" : "dir",
        );
        fs.mkdirSync(path.dirname(excludedLink), { recursive: true });
        fs.symlinkSync(
          linkedTarget,
          excludedLink,
          process.platform === "win32" ? "junction" : "dir",
        );
        assert.throws(
          () => request(),
          (error: unknown) =>
            error instanceof Error &&
            error.message.includes("contains a link at") &&
            error.message.includes(linkedInput),
        );
        assert.deepEqual(
          buildInvocations(),
          beforeLinkBuilds,
          "refusing the included link must issue no additional go build",
        );
        fs.unlinkSync(linkedInput);
        fs.cpSync(linkedTarget, linkedInput, { recursive: true });
        assert.equal(
          fs.existsSync(request()),
          true,
          "owned source files recover while the excluded link remains",
        );
      } finally {
        if (fs.existsSync(linkedInput)) {
          if (fs.lstatSync(linkedInput).isSymbolicLink())
            fs.unlinkSync(linkedInput);
          else fs.rmSync(linkedInput, { recursive: true });
        }
        if (fs.existsSync(excludedLink)) fs.unlinkSync(excludedLink);
      }
      if (process.platform !== "win32") {
        fs.chmodSync(tool, 0o666);
        ensureExecutableGoToolchain(tool, true);
        assert.equal(fs.statSync(tool).mode & 0o7777, 0o755);
        fs.chmodSync(tool, 0o666);
        assert.equal(fs.existsSync(request()), true);
        assert.equal(
          fs.statSync(tool).mode & 0o7777,
          0o766,
          "external tool gains only required owner execute before metadata",
        );
        fs.chmodSync(tool, 0o700);
        request();
        assert.equal(
          fs.statSync(tool).mode & 0o7777,
          0o700,
          "already-executable external permissions remain restrictive",
        );
      }
    } catch (error) {
      publicApiFailures.push(
        new Error("shared source tool environment and permission protocol", {
          cause: error,
        }),
      );
    } finally {
      // Parent absence was established before taking ownership; never delete a
      // pre-existing module directory after a failed setup assertion.
      for (const directory of toolInputsOwned ? ownedToolDirectories : []) {
        const target = path.join(replacementModule, directory);
        assert.ok(
          path
            .resolve(target)
            .startsWith(path.resolve(replacementModule) + path.sep),
        );
        fs.rmSync(target, { recursive: true, force: true });
      }
      assert.ok(
        path
          .resolve(toolProtocol)
          .startsWith(path.resolve(workspace.root) + path.sep),
      );
      fs.rmSync(toolProtocol, { recursive: true, force: true });
    }
    const capabilityCache = path.join(
      workspace.cache,
      "capability-source-flow",
    );
    const capabilityCounter = path.join(
      traceRoot,
      "capability-evaluations.log",
    );
    const hoistedCapability = path.join(
      workspace.root,
      "node_modules/batch-cache-capability",
    );
    const nearerCapability = path.join(
      workspace.root,
      "descriptors/node_modules/batch-cache-capability",
    );
    const capabilityProducer = path.join(nativeProbe.fixtureSource, "probe.go");
    const originalCapabilityProducer = fs.readFileSync(capabilityProducer);
    const capabilityEnvironment = {
      TTSC_BINARY: TestProject.TSGO_BINARY,
      TTSC_CACHE_DIR: capabilityCache,
      TTSC_NODE_BINARY: process.execPath,
      GOFLAGS: baselineBuildEnv.GOFLAGS,
      TTSC_E2E_TRACE: traceRoot,
    };
    const savedCapabilityEnvironment = Object.fromEntries(
      Object.keys(capabilityEnvironment).map((key) => [key, process.env[key]]),
    );
    const applyCapabilityEnvironment = (values: NodeJS.ProcessEnv): void => {
      for (const [key, value] of Object.entries(values))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    };
    const selectCapabilityObservation = (observation: string): void => {
      const config = JSON.parse(originalConfig.toString("utf8"));
      config.compilerOptions.plugins = [
        {
          ...publicNativeProbe,
          cacheObservation: observation,
          evaluationCounter: capabilityCounter,
        },
      ];
      fs.writeFileSync(configPath, JSON.stringify(config));
    };
    const capabilityAnswer = () =>
      resolveCapabilityPlugins({
        capability: "probe",
        cwd: workspace.root,
        tsconfig: configPath,
      });
    const capabilityRecord = (): string => {
      const file = CapabilityResolutionFormat.resolutionFile({
        cwd: workspace.root,
        tsconfig: configPath,
      });
      assert.equal(
        typeof file,
        "string",
        "supported runtime authority must own a persisted capability answer",
      );
      return file!;
    };
    const capabilityIdentity = (): { binary: string; inode: string | null } => {
      const traceOffsets = Object.fromEntries(
        fs
          .readdirSync(traceRoot)
          .filter((name) => name.endsWith(".jsonl"))
          .map((name) => [
            name,
            fs
              .readFileSync(path.join(traceRoot, name), "utf8")
              .split(/\r?\n/)
              .filter(Boolean).length,
          ]),
      );
      const resolution = resolveCapabilityPluginResolution({
        capability: "probe",
        cwd: workspace.root,
        tsconfig: configPath,
      });
      const answer = resolution.plugins;
      assert.equal(answer.length, 1);
      assert.equal(fs.existsSync(answer[0]!.binary), true);
      const file = capabilityRecord();
      if (!descriptorReuseAvailable) {
        assert.equal(resolution.status, "resolved");
        assert.equal(
          resolution.isCurrent(),
          false,
          "a runtime without independent resolve observation cannot certify a reusable capability answer",
        );
        assert.equal(
          fs.existsSync(file),
          false,
          "the actual capability may be returned without publishing unproved reusable authority",
        );
        return { binary: answer[0]!.binary, inode: null };
      }
      assert.equal(
        fs.existsSync(file),
        true,
        "the resolved capability must publish the independently keyed answer record; actual same-call authority: " +
          JSON.stringify({
            status: resolution.status,
            isCurrent: resolution.isCurrent(),
            file,
            runtime: process.execPath,
            nodeBinary: process.env.TTSC_NODE_BINARY ?? null,
            nodeOptions: process.env.NODE_OPTIONS ?? null,
            cache: process.env.TTSC_CACHE_DIR,
            capabilityTrace: fs
              .readdirSync(traceRoot)
              .filter((name) => name.endsWith(".jsonl"))
              .flatMap((name) =>
                fs
                  .readFileSync(path.join(traceRoot, name), "utf8")
                  .split(/\r?\n/)
                  .filter(Boolean)
                  .slice(traceOffsets[name] ?? 0)
                  .map((line) => ({ file: name, event: JSON.parse(line) }))
                  .filter(
                    (row) =>
                      row.event.event === "capability-resolution" ||
                      row.event.event === "integrity-failure",
                  ),
              ),
            binary: answer[0]!.binary,
            evaluations: fs.existsSync(capabilityCounter)
              ? fs.readFileSync(capabilityCounter, "utf8")
              : null,
          }),
      );
      return {
        binary: answer[0]!.binary,
        inode: String(fs.statSync(file, { bigint: true }).ino),
      };
    };
    try {
      applyCapabilityEnvironment(capabilityEnvironment);
      selectCapabilityObservation("capability-module");
      const first = capabilityIdentity();
      assert.deepEqual(
        capabilityIdentity(),
        first,
        "unchanged proof must retain the actual binary and answer record",
      );
      assert.equal(
        fs.readFileSync(capabilityCounter, "utf8"),
        descriptorReuseAvailable ? "x" : "xx",
      );
      fs.appendFileSync(capabilityProducer, "\n// capability source epoch\n");
      const edited = capabilityIdentity();
      assert.notEqual(edited.binary, first.binary);
      if (descriptorReuseAvailable) assert.notEqual(edited.inode, first.inode);
      assert.equal(
        fs.readFileSync(capabilityCounter, "utf8"),
        descriptorReuseAvailable ? "x" : "xxx",
        "unchanged descriptor evaluation survives a source-only rebuild",
      );
      applyCapabilityEnvironment({ GOFLAGS: "-tags=ttsc_capability_probe" });
      const flagged = capabilityIdentity();
      assert.notEqual(flagged.binary, edited.binary);
      if (descriptorReuseAvailable)
        assert.notEqual(flagged.inode, edited.inode);
      assert.equal(
        fs.readFileSync(capabilityCounter, "utf8"),
        descriptorReuseAvailable ? "xx" : "xxxx",
      );
      const ignored = path.join(
        path.dirname(nativeProbe.fixtureSource),
        "node_modules/capability-ignored/index.js",
      );
      assert.equal(fs.existsSync(ignored), false);
      fs.mkdirSync(path.dirname(ignored), { recursive: true });
      fs.writeFileSync(ignored, "// excluded source epoch\n");
      try {
        assert.deepEqual(capabilityIdentity(), flagged);
      } finally {
        fs.rmSync(path.dirname(ignored), { recursive: true });
      }

      selectCapabilityObservation("capability-undeclared");
      fs.writeFileSync(descriptorSettings, '{"probe":true}\n');
      assert.equal(capabilityAnswer().length, 1);
      fs.writeFileSync(descriptorSettings, '{"probe":false}\n');
      assert.equal(
        capabilityAnswer().length,
        0,
        "an undeclared read cannot keep its earlier capability",
      );

      assert.equal(fs.existsSync(hoistedCapability), false);
      assert.equal(fs.existsSync(nearerCapability), false);
      fs.mkdirSync(hoistedCapability, { recursive: true });
      fs.writeFileSync(
        path.join(hoistedCapability, "package.json"),
        '{"name":"batch-cache-capability","main":"index.cjs"}\n',
      );
      fs.writeFileSync(
        path.join(hoistedCapability, "index.cjs"),
        "module.exports = { probe: true };\n",
      );
      selectCapabilityObservation("capability-race");
      assert.equal(
        capabilityAnswer().length,
        1,
        "the first evaluation reads the independently authored hoisted capability",
      );
      const second = capabilityAnswer().length;
      fs.rmSync(capabilityRecord(), { force: true });
      const fresh = capabilityAnswer().length;
      assert.equal(
        fresh,
        0,
        "a fresh evaluation selects the nearer false capability",
      );
      assert.equal(
        second,
        fresh,
        "load-time candidate appearance must invalidate the earlier answer",
      );
    } catch (error) {
      publicApiFailures.push(
        new Error("capability source/read-authority state flow", {
          cause: error,
        }),
      );
    } finally {
      applyCapabilityEnvironment(savedCapabilityEnvironment);
      fs.writeFileSync(configPath, originalConfig);
      fs.writeFileSync(descriptorSettings, originalSettings);
      fs.writeFileSync(capabilityProducer, originalCapabilityProducer);
      for (const owned of [hoistedCapability, nearerCapability]) {
        assert.equal(
          path.relative(workspace.root, owned).startsWith(".."),
          false,
        );
        fs.rmSync(owned, { recursive: true, force: true });
      }
    }
    try {
      // Corrupt the existing package bytes rather than authoring another Go
      // fixture. The executable entry remains classifiable, but its imported
      // producer cannot build; the independent TS assignment must still surface.
      const invalidProducer = Buffer.from(originalCapabilityProducer);
      invalidProducer[0] = 0;
      fs.writeFileSync(capabilityProducer, invalidProducer);
      fs.writeFileSync(
        contractPath,
        Buffer.concat([
          originalContract,
          Buffer.from('\nconst wrong: number = "type-error";\nvoid wrong;\n'),
        ]),
      );
      const failed = new TtscCompiler({
        binary: TestProject.TSGO_BINARY,
        cwd: workspace.root,
        plugins: [publicNativeProbe],
        env: {
          TTSC_CACHE_DIR: path.join(
            workspace.cache,
            "public-failure-source-flow",
          ),
          GOFLAGS: baselineBuildEnv.GOFLAGS,
        },
      }).compile();
      assert.equal(failed.type, "failure");
      assert.equal(
        failed.diagnostics.some((diagnostic) => diagnostic.code === 2322),
        true,
        "actual setup failure must not hide the independent TypeScript assignment error",
      );
      assert.equal(
        failed.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "TTSC_PROCESS" &&
            /building plugin/.test(diagnostic.messageText),
        ),
        true,
        "the public failure must retain the actual native preparation error",
      );
    } catch (error) {
      publicApiFailures.push(
        new Error(
          "native setup failure followed by TypeScript diagnostic recovery",
          { cause: error },
        ),
      );
    } finally {
      fs.writeFileSync(capabilityProducer, originalCapabilityProducer);
      fs.writeFileSync(contractPath, originalContract);
    }
    // Actual compiled fixture stderr/status goes through the public launcher
    // and its real TypeScript fallback in this same project state flow.
    const diagnosticMain = path.join(workspace.root, "src/main.ts");
    const diagnosticMainBefore = fs.existsSync(diagnosticMain)
      ? fs.readFileSync(diagnosticMain)
      : undefined;
    const nativeFailureCache = path.join(
      workspace.cache,
      "public-native-failure-lanes",
    );
    const diagnosticLane = (
      mode: string,
      stage: "check" | "transform",
      noEmit: boolean,
    ): void => {
      try {
        const configured = JSON.parse(originalConfig.toString("utf8"));
        configured.compilerOptions.plugins = [{ ...publicNativeProbe, stage }];
        fs.writeFileSync(configPath, JSON.stringify(configured));
        const result = TestProject.spawn(
          TestProject.TTSC_BIN,
          ["--cwd", workspace.root, ...(noEmit ? ["--noEmit"] : [])],
          {
            cwd: workspace.root,
            env: {
              ...baselineBuildEnv,
              TTSC_CACHE_DIR: nativeFailureCache,
              TTSC_E2E_PUBLIC_PROBE_MODE: mode,
            },
          },
        );
        assert.ifError(result.error);
        assert.equal(result.signal, null);
        assert.equal(typeof result.status, "number");
        if (mode === "check-warning") {
          assert.notEqual(result.status, 0);
          assert.match(result.stderr, /TS9001: check warning/);
        } else {
          assert.equal(result.status, 3, result.stderr);
          assert.match(
            result.stderr,
            stage === "check"
              ? /check plugin crashed/
              : /transform plugin crashed/,
          );
        }
        assert.equal(
          result.stderr.match(/TS2322/g)?.length,
          2,
          "the actual fallback must preserve both independent assignments exactly once: " +
            result.stderr,
        );
      } catch (error) {
        publicApiFailures.push(
          new Error(
            `actual native ${mode}/${noEmit ? "noEmit" : "emit"} diagnostic lane`,
            { cause: error },
          ),
        );
      }
    };
    try {
      fs.writeFileSync(
        diagnosticMain,
        'const first: number = "first-error";\nconst second: number = "second-error";\nconsole.log(first, second);\nexport {};\n',
      );
      diagnosticLane("check-warning", "check", true);
      diagnosticLane("check-failure", "check", true);
      diagnosticLane("transform-failure", "transform", false);
      diagnosticLane("transform-failure", "transform", true);
    } finally {
      fs.writeFileSync(configPath, originalConfig);
      if (diagnosticMainBefore === undefined) fs.unlinkSync(diagnosticMain);
      else fs.writeFileSync(diagnosticMain, diagnosticMainBefore);
    }
    const proofDependency = path.join(
      workspace.root,
      "descriptors/observation-dependency.cjs",
    );
    const oldProofTarget = path.join(
      workspace.root,
      "descriptors/observation-old",
    );
    const newProofTarget = path.join(
      workspace.root,
      "descriptors/observation-new",
    );
    const proofLink = path.join(workspace.root, "descriptors/observation-link");
    const proofCounter = path.join(traceRoot, "moving-input-evaluations.log");
    for (const owned of [
      proofDependency,
      oldProofTarget,
      newProofTarget,
      proofLink,
    ])
      assert.equal(fs.existsSync(owned), false);
    try {
      const before = 'module.exports = { name: "before" };\n';
      fs.writeFileSync(proofDependency, before);
      const loadedAba = loadProjectPlugins({
        binary: TestProject.TSGO_BINARY,
        cwd: workspace.root,
        tsconfig: configPath,
        cacheDir: path.join(workspace.cache, "moving-input-descriptors"),
        env: descriptorEnv,
        entries: [
          {
            ...publicNativeProbe,
            cacheObservation: "descriptor-aba",
            evaluationCounter: proofCounter,
            observationDependency: proofDependency,
          },
        ],
      });
      assert.equal(loadedAba.nativePlugins[0]?.name, "during");
      assert.equal(fs.readFileSync(proofDependency, "utf8"), before);
      assert.equal(loadedAba.hostInputs.includes(proofDependency), true);
      assert.equal(
        Object.hasOwn(loadedAba.hostInputHashes, proofDependency),
        false,
        "ABA bytes must remain watched without claiming that the during value came from restored bytes",
      );

      const selectionSource = 'module.exports = require("./value.cjs");\n';
      for (const [directory, name] of [
        [oldProofTarget, "old"],
        [newProofTarget, "new"],
      ]) {
        fs.mkdirSync(directory!);
        fs.writeFileSync(
          path.join(directory!, "selection.cjs"),
          selectionSource,
        );
        fs.writeFileSync(
          path.join(directory!, "value.cjs"),
          "module.exports = { name: " + JSON.stringify(name) + " };\n",
        );
      }
      fs.symlinkSync(
        oldProofTarget,
        proofLink,
        process.platform === "win32" ? "junction" : "dir",
      );
      const linkedSelection = path.join(proofLink, "selection.cjs");
      assert.equal(
        fs.realpathSync.native(linkedSelection),
        fs.realpathSync.native(path.join(oldProofTarget, "selection.cjs")),
      );
      const loadedRetarget = loadProjectPlugins({
        binary: TestProject.TSGO_BINARY,
        cwd: workspace.root,
        tsconfig: configPath,
        cacheDir: path.join(workspace.cache, "moving-input-descriptors"),
        env: descriptorEnv,
        entries: [
          {
            ...publicNativeProbe,
            cacheObservation: "descriptor-retarget",
            evaluationCounter: proofCounter,
            observationLink: proofLink,
            observationTarget: newProofTarget,
          },
        ],
      });
      assert.equal(
        fs.readFileSync(path.join(oldProofTarget, "selection.cjs"), "utf8"),
        selectionSource,
      );
      assert.equal(
        fs.readFileSync(path.join(newProofTarget, "selection.cjs"), "utf8"),
        selectionSource,
      );
      assert.equal(loadedRetarget.nativePlugins[0]?.name, "old");
      assert.equal(
        fs.realpathSync.native(linkedSelection),
        fs.realpathSync.native(path.join(newProofTarget, "selection.cjs")),
      );
      assert.equal(loadedRetarget.hostInputs.includes(linkedSelection), true);
      assert.equal(
        Object.hasOwn(loadedRetarget.hostInputHashes, linkedSelection),
        false,
      );
      assert.equal(
        Object.hasOwn(loadedRetarget.hostInputRealpaths, linkedSelection),
        false,
      );
    } catch (error) {
      publicApiFailures.push(
        new Error("descriptor ABA/retarget input proof", { cause: error }),
      );
    } finally {
      if (fs.existsSync(proofLink)) {
        assert.equal(fs.lstatSync(proofLink).isSymbolicLink(), true);
        fs.unlinkSync(proofLink);
      }
      fs.rmSync(proofDependency, { force: true });
      for (const owned of [oldProofTarget, newProofTarget]) {
        assert.equal(
          path.relative(workspace.root, owned).startsWith(".."),
          false,
        );
        fs.rmSync(owned, { recursive: true, force: true });
      }
    }
    for (const stage of ["transform", "check"] as const) {
      try {
        fs.writeFileSync(descriptorSettings, "old\n");
        const raceAttempt = fs.existsSync(workspace.programRunLog)
          ? fs.statSync(workspace.programRunLog).size
          : 0;
        const result = new TtscCompiler({
          binary: TestProject.TSGO_BINARY,
          cwd: workspace.root,
          plugins: [
            {
              ...publicNativeProbe,
              cacheObservation: "native-proof",
              evaluationCounter: proofCounter,
              stage,
              raceAttempt,
              raceFile: descriptorSettings,
              raceContent: "new\n",
              ...(stage === "check"
                ? { reportedFiles: ["src/missing-proof-control.ts"] }
                : {}),
            },
          ],
          env: {
            TTSC_CACHE_DIR: path.join(workspace.cache, "moving-native-inputs"),
            GOFLAGS: baselineBuildEnv.GOFLAGS,
          },
        }).transform();
        assert.equal(
          result.type,
          stage === "transform" ? "success" : "failure",
          JSON.stringify(result),
        );
        assert.equal(result.hostInputs?.includes(descriptorSettings), true);
        assert.equal(
          Object.hasOwn(result.hostInputHashes ?? {}, descriptorSettings),
          false,
          stage +
            " must not retain the hash read before actual native execution",
        );
        assert.equal(fs.readFileSync(descriptorSettings, "utf8"), "new\n");
      } catch (error) {
        publicApiFailures.push(
          new Error(stage + " after-native host proof invalidation", {
            cause: error,
          }),
        );
      } finally {
        fs.writeFileSync(descriptorSettings, originalSettings);
      }
    }
    baseline = fs.existsSync(workspace.programRunLog)
      ? fs.statSync(workspace.programRunLog).size
      : 0;
    receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
    caseOffset = fs.existsSync(workspace.casePolicyReceipt)
      ? fs
          .readFileSync(workspace.casePolicyReceipt, "utf8")
          .split(/\r?\n/)
          .filter(Boolean).length
      : 0;
    nativeProbe.raceAttempt = baseline;
    nativeProbe.raceFile = nonInputRaceFile;
    nativeProbe.raceContent = nonInputRaceContent;
    const unrelatedPath = path.join(
      workspace.root,
      "batch-unrelated-candidate.txt",
    );
    const ignoredOutput = path.join(
      workspace.root,
      "dist/batch-hashed-a9137.js",
    );
    const candidate = path.join(
      workspace.root,
      "node_modules/batch-record-dependency/index.ts",
    );
    const declaration = path.join(
      workspace.root,
      "node_modules/batch-record-dependency/index.d.ts",
    );
    const unrelatedPackageFile = path.join(
      workspace.root,
      "node_modules/batch-record-dependency/unrelated.txt",
    );
    const addedRoot = path.join(workspace.root, "src/pooled-membership.d.ts");
    const installedDescriptor = path.join(
      workspace.root,
      "packages/batch-descriptor-input/index.cjs",
    );
    const originalInstalledDescriptor = fs.readFileSync(installedDescriptor);
    const optionalDescriptor = path.join(
      workspace.root,
      "descriptors/optional.cjs",
    );
    assert.equal(fs.existsSync(optionalDescriptor), false);
    for (const owned of [candidate, unrelatedPackageFile, addedRoot])
      assert.equal(fs.existsSync(owned), false);
    const originalDeclaration = fs.readFileSync(declaration);
    const descriptorInputs = [
      "package.json",
      "descriptors/default.cjs",
      "descriptors/input.cjs",
      "packages/batch-descriptor-input/package.json",
      "packages/batch-descriptor-input/index.cjs",
      "packages/batch-auto-discovery/package.json",
      "packages/batch-auto-discovery/index.cjs",
    ].map((name) => fs.realpathSync.native(path.join(workspace.root, name)));
    const descriptorBytes = new Map(
      descriptorInputs.map((input) => [input, fs.readFileSync(input)]),
    );
    const assertDescriptorBytes = (
      input: string,
      evidence:
        | {
            missing?: boolean;
            state?: {
              codec: string;
              hash?: string;
              observation?: { readFile?: { ok: boolean; hash?: string } };
            };
          }
        | undefined,
      authored: Buffer | string,
    ): void => {
      const expectedHash = crypto
        .createHash("sha256")
        .update(authored)
        .digest("hex");
      const state = evidence?.state;
      const diagnostic =
        "descriptor byte proof: " +
        JSON.stringify({ input, state, expectedHash });
      assert.ok(evidence, diagnostic);
      assert.equal(evidence.missing, false, diagnostic);
      assert.ok(state, diagnostic);
      assert.ok(
        state.codec === "host" ||
          state.codec === "graph" ||
          state.codec === "predicates",
        diagnostic,
      );
      if (state.codec === "predicates") {
        // These authored UTF-8 inputs contain no BOM. A successful compiler
        // ReadFile therefore hashes the same bytes; existence alone is no proof.
        assert.deepEqual(
          state.observation?.readFile,
          { ok: true, hash: expectedHash },
          diagnostic,
        );
      } else {
        assert.equal(state.hash, expectedHash, diagnostic);
      }
      assert.deepEqual(
        fs.readFileSync(input),
        Buffer.from(authored),
        "the native producer must not mutate the independently captured descriptor input: " +
          input,
      );
    };
    const rootCase = compilerUsesCaseSensitiveFileNames({
      cacheDir: workspace.cache,
      projectRoot: workspace.root,
    });
    const siblingCase = compilerUsesCaseSensitiveFileNames({
      cacheDir: path.join(workspace.root, "sibling-case-cache"),
      projectRoot: workspace.root,
    });
    const descriptorFailureRoot = path.join(
      workspace.root,
      "descriptor-process-flow",
    );
    assert.equal(fs.existsSync(descriptorFailureRoot), false);
    fs.cpSync(
      path.join(
        TestProject.WORKSPACE_ROOT,
        "tests/test-e2e/fixtures/ttsc/descriptor-process-corpus",
      ),
      descriptorFailureRoot,
      { recursive: true },
    );
    const lintDescriptorRoot = path.join(descriptorFailureRoot, "lint-flow");
    fs.cpSync(
      path.join(workspace.root, "descriptors/lint-flow"),
      lintDescriptorRoot,
      { recursive: true },
    );
    const lintAlpha = nativeProbe.fixtureSource as string;
    const lintBeta = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/lint/plugin",
    );
    for (const filename of [
      "typed-selection.ts",
      "module-selection.mjs",
      "logging-contributor.cjs",
    ]) {
      const file = path.join(lintDescriptorRoot, filename);
      fs.writeFileSync(
        file,
        fs
          .readFileSync(file, "utf8")
          .replace('"__LINT_ALPHA_SOURCE__"', JSON.stringify(lintAlpha)),
      );
    }
    const loggingPackage = path.join(
      lintDescriptorRoot,
      "node_modules/logging-contributor",
    );
    fs.mkdirSync(loggingPackage, { recursive: true });
    fs.writeFileSync(
      path.join(loggingPackage, "package.json"),
      '{"main":"index.cjs"}\n',
    );
    fs.copyFileSync(
      path.join(lintDescriptorRoot, "logging-contributor.cjs"),
      path.join(loggingPackage, "index.cjs"),
    );
    fs.writeFileSync(
      path.join(lintDescriptorRoot, "lint.config.json"),
      JSON.stringify({ plugins: { demo: "logging-contributor" } }),
    );
    const lintDescriptorBytes = new Map(
      ["lint.config.ts", "typed-selection.ts", "module-selection.mjs"].map(
        (name) => [
          path.join(lintDescriptorRoot, name),
          fs.readFileSync(path.join(lintDescriptorRoot, name)),
        ],
      ),
    );
    const descriptorRuntimeRoot = path.join(
      descriptorFailureRoot,
      "runtime-inputs",
    );
    const runtimeDescriptor = path.join(descriptorRuntimeRoot, "descriptor");
    const runtimeDescriptorConfig = path.join(
      runtimeDescriptor,
      "tsconfig.json",
    );
    const runtimeSelection = path.join(runtimeDescriptor, "selection.mjs");
    const runtimeNear = path.join(descriptorRuntimeRoot, "near/node_modules");
    const runtimeFar = path.join(descriptorRuntimeRoot, "far/node_modules");
    const runtimeProbe = path.join(runtimeFar, "descriptor-probe");
    const runtimeOrphan = path.join(
      descriptorRuntimeRoot,
      "orphan/node_modules/orphan-source",
    );
    const runtimeRefresh = path.join(
      descriptorRuntimeRoot,
      "refresh/node_modules/config-refresh",
    );
    for (const directory of [
      runtimeDescriptor,
      path.join(runtimeNear, "descriptor-probe"),
      runtimeProbe,
      runtimeOrphan,
      runtimeRefresh,
    ])
      fs.mkdirSync(directory, { recursive: true });
    for (const directory of [runtimeDescriptor, runtimeOrphan, runtimeRefresh])
      fs.writeFileSync(
        path.join(directory, "package.json"),
        '{"private":true,"type":"module"}\n',
      );
    fs.writeFileSync(
      runtimeDescriptorConfig,
      JSON.stringify({
        compilerOptions: {
          allowJs: true,
          module: "nodenext",
          moduleResolution: "nodenext",
          skipLibCheck: true,
          target: "es2022",
        },
        include: ["*.ts", "*.mjs"],
      }),
    );
    fs.writeFileSync(
      runtimeSelection,
      `export const source = ${JSON.stringify(publicNativeProbe.fixtureSource)};\n`,
    );
    fs.writeFileSync(
      path.join(runtimeDescriptor, "explicit.tsx"),
      'export const explicit = "explicit";\n',
    );
    fs.writeFileSync(
      path.join(runtimeProbe, "package.json"),
      '{"main":"entry"}\n',
    );
    fs.writeFileSync(path.join(runtimeProbe, "entry.json"), '"probe"\n');
    fs.writeFileSync(
      path.join(runtimeOrphan, "selection.ts"),
      'export const orphan = "orphan";\n',
    );
    const runtimeRefreshConfig = path.join(runtimeRefresh, "tsconfig.json");
    fs.writeFileSync(
      path.join(runtimeRefresh, "selection.tsx"),
      'function factory() { return "configured"; }\nexport const value = <probe />;\n',
    );
    fs.writeFileSync(
      path.join(runtimeRefresh, "seed.ts"),
      [
        'import { writeFileSync } from "node:fs";',
        'import { createRequire } from "node:module";',
        `writeFileSync(${JSON.stringify(runtimeRefreshConfig)}, ${JSON.stringify(JSON.stringify({ compilerOptions: { jsx: "react", jsxFactory: "factory", module: "nodenext", moduleResolution: "nodenext", target: "es2022" }, include: ["*.ts", "*.tsx"] }))});`,
        'export const seed = "seed";',
        'export const { value } = createRequire(import.meta.url)("./selection.tsx");',
        "",
      ].join("\n"),
    );
    const runtimeDescriptorEntry = path.join(runtimeDescriptor, "index.ts");
    fs.writeFileSync(
      runtimeDescriptorEntry,
      [
        'import { createRequire } from "node:module";',
        'import { source } from "./selection";',
        'import { explicit } from "./explicit.js?descriptor-input";',
        `import { orphan } from ${JSON.stringify(pathToFileURL(path.join(runtimeOrphan, "selection.ts")).href)};`,
        `import { seed, value } from ${JSON.stringify(pathToFileURL(path.join(runtimeRefresh, "seed.ts")).href)};`,
        "const require = createRequire(import.meta.url);",
        'if (require("descriptor-probe") !== "probe" || orphan !== "orphan" || explicit !== "explicit") throw new Error("descriptor probe failed");',
        'if (seed !== "seed" || value !== "configured") throw new Error("descriptor config refresh failed");',
        'export default () => ({ name: "ttsx-inputs", source, capabilities: { projectContextArgs: true } });',
        "",
      ].join("\n"),
    );
    const runtimeInputConfig = path.join(
      descriptorRuntimeRoot,
      "tsconfig.json",
    );
    fs.writeFileSync(
      runtimeInputConfig,
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: runtimeDescriptorEntry }] },
      }),
    );
    const runtimeDescriptorConfigHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(runtimeDescriptorConfig))
      .digest("hex");
    const pluginLockRoot = path.join(
      workspace.cache,
      "resident-plugin-lock-graph",
      path.basename(workspace.root),
    );
    // This pool checks its native bundle graph and reached external declaration.
    // Runtime-only wasm/playground consumers own a different ambient surface;
    // they are not roots of this adapter Program. Imported matrix sources remain
    // in the actual closure, and the later membership declaration is a root.
    // Establish this same consumer input owner before its first graph-proof
    // request, not after descriptor flow. All configured contributors and direct
    // package-marker discovery stay unchanged for both captures and later calls.
    poolConfig.include = [
      "src/bundle.ts",
      "src/map.ts",
      "src/pool-routing/map.ts",
      "src/console.d.ts",
      "src/metadata-population.ts",
      "src/pooled-membership.d.ts",
    ];
    poolConfig.compilerOptions.skipLibCheck = false;
    fs.writeFileSync(configPath, JSON.stringify(poolConfig));
    const workers = (["metro", "turbopack"] as const).map((mode) =>
      createLoaderPoolWorker({
        mode,
        root: workspace.root,
        cache: workspace.cache,
        session,
        traceRoot,
        metro: pathToFileURL(path.join(lib, "transformer.js")).href,
        turbopack: TestUnpluginRuntime.libUrl("turbopack"),
      }),
    );
    let finalRecord: string | undefined;
    let bodyFailure: unknown;
    try {
      const graphProof = await workers[0]!.request("", undefined, undefined, {
        api: TestUnpluginRuntime.libUrl("api"),
        session: path.join(
          workspace.cache,
          "graph-proof-refusal",
          path.basename(workspace.root),
        ),
        programRunLog: workspace.programRunLog,
      });
      try {
        assert.equal(graphProof.error, undefined, graphProof.error);
        assert.deepEqual(graphProof.value, {
          proofRead: true,
          nativePrograms: 2,
          served: true,
        });
      } catch (error) {
        publicApiFailures.push(
          new Error("outside-walk graph proof publication refusal", {
            cause: error,
          }),
        );
      }
      // The two real captures above have their own receipt epoch. Initial adapter
      // sharing below still independently requires one additional native Program.
      baseline = fs.existsSync(workspace.programRunLog)
        ? fs.statSync(workspace.programRunLog).size
        : 0;
      receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
      caseOffset = fs.existsSync(workspace.casePolicyReceipt)
        ? fs
            .readFileSync(workspace.casePolicyReceipt, "utf8")
            .split(/\r?\n/)
            .filter(Boolean).length
        : 0;
      nativeProbe.raceAttempt = baseline;
      await observePluginLockGraph({
        root: pluginLockRoot,
        fixture: path.join(workspace.root, "plugin-lock-session.cjs"),
        api: path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/ttsc/lib/plugin/internal/source",
        ),
        workers,
      });
      const descriptorReply = await workers[0]!.request("", undefined, {
        root: descriptorFailureRoot,
        api: path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/ttsc/lib/plugin/internal/load/loadProjectPlugins.js",
        ),
        binary: TestProject.NATIVE_BINARY,
        tsgo: TestProject.TSGO_BINARY,
        lint: {
          root: lintDescriptorRoot,
          factory: path.join(
            TestProject.WORKSPACE_ROOT,
            "packages/lint/lib/index.js",
          ),
          ttsx: TestProject.TTSX_BIN,
          alpha: lintAlpha,
          beta: lintBeta,
        },
      });
      assert.equal(descriptorReply.error, undefined);
      const descriptorRecords = descriptorReply.value as {
        name: string;
        failed: boolean;
        message?: string;
        contributors?: { name: string; source: string }[];
      }[];
      assert.deepEqual(
        descriptorRecords.map((record) => record.name),
        [
          "factory",
          "module",
          "counterfeit",
          "counterfeit-missing",
          "mutated-missing",
          "late-candidate-race",
          "directory-candidate-race",
          "context",
          "body",
          "lint-initial",
          "lint-module-edit",
          "lint-typed-edit",
          "lint-typed-collision",
          "lint-typed-failure",
          "lint-json-log",
        ],
      );
      for (const [name, contributors] of [
        ["lint-initial", [{ name: "alpha", source: lintAlpha }]],
        [
          "lint-module-edit",
          [
            { name: "beta", source: lintBeta },
            { name: "alpha", source: lintAlpha },
          ],
        ],
        ["lint-typed-edit", [{ name: "beta", source: lintBeta }]],
        ["lint-json-log", [{ name: "demo", source: lintAlpha }]],
      ] as const) {
        const observed = descriptorRecords.find((row) => row.name === name);
        assert.equal(observed?.failed, false, name + ": " + observed?.message);
        assert.deepEqual(
          observed?.contributors,
          contributors,
          "actual helper-only re-evaluation and JSON package selection: " +
            name,
        );
      }
      const lintCollision = descriptorRecords.find(
        (row) => row.name === "lint-typed-collision",
      );
      assert.equal(lintCollision?.failed, true);
      assert.equal(lintCollision?.contributors, undefined);
      assert.ok(
        lintCollision?.message?.includes(
          path.join(lintDescriptorRoot, "lint.config.ts"),
        ),
      );
      assert.match(
        lintCollision?.message ?? "",
        /"react-hooks", "react_hooks" all normalize to "react_hooks"/,
      );
      assert.match(
        lintCollision?.message ?? "",
        /contributor namespaces collide/,
      );
      const lintFailure = descriptorRecords.find(
        (row) => row.name === "lint-typed-failure",
      );
      assert.equal(lintFailure?.failed, true);
      assert.equal(
        lintFailure?.contributors,
        undefined,
        "failed typed evaluation must not publish contributor JSON",
      );
      assert.match(lintFailure?.message ?? "", /intentional config failure/);
      assert.match(
        lintFailure?.message ?? "",
        /evaluation failed with exit code/,
      );
      for (const [file, bytes] of lintDescriptorBytes)
        assert.deepEqual(
          fs.readFileSync(file),
          bytes,
          "the retained worker restores its typed/MJS config epoch before adapter admission",
        );
      assert.equal(
        fs.existsSync(
          path.join(descriptorFailureRoot, "forbidden-fallback.txt"),
        ),
        false,
      );
      for (const [name, reason] of [
        ["factory", /factory-env:effective/],
        ["module", /module-initialization:loaded/],
        ["counterfeit", /user-assigned loader code/],
        ["counterfeit-missing", /Cannot find module '\.\/phantom'/],
        ["mutated-missing", /Cannot find module '\.\/phantom'/],
        ["late-candidate-race", /Cannot find module '\.\/late-candidate'/],
        [
          "directory-candidate-race",
          /Cannot find module '\.\/directory-candidate'/,
        ],
        ["context", /absent-context-only/],
        ["body", /failed with exit code 1\ndescriptor-module-body-failed/],
      ] as const) {
        try {
          const record = descriptorRecords.find((entry) => entry.name === name);
          assert.equal(record?.failed, true);
          assert.match(record?.message ?? "", reason);
          if (name !== "context" && name !== "body")
            assert.equal(
              fs.readFileSync(
                path.join(descriptorFailureRoot, name + "-runs.txt"),
                "utf8",
              ),
              "run\n",
            );
        } catch (cause) {
          publicApiFailures.push(
            new Error("descriptor failure state: " + name, { cause }),
          );
        }
      }
      assert.equal(
        fs.readFileSync(
          path.join(descriptorFailureRoot, "late-candidate.ts"),
          "utf8",
        ),
        "export const value = 1;\n",
      );
      assert.equal(
        fs
          .statSync(path.join(descriptorFailureRoot, "directory-candidate.ts"))
          .isDirectory(),
        true,
      );
      const runtimeInputReply = await workers[0]!.request("", undefined, {
        root: descriptorFailureRoot,
        api: path.join(
          TestProject.WORKSPACE_ROOT,
          "packages/ttsc/lib/plugin/internal/load/loadProjectPlugins.js",
        ),
        binary: TestProject.NATIVE_BINARY,
        tsgo: TestProject.TSGO_BINARY,
        runtimeInputs: {
          config: runtimeInputConfig,
          cache: path.join(workspace.cache, "descriptor-runtime-inputs"),
          nodePath: [runtimeNear, runtimeFar].join(path.delimiter),
        },
      });
      assert.equal(runtimeInputReply.error, undefined);
      const runtimeInputs = runtimeInputReply.value as {
        hostInputs: string[];
        hostInputHashes: Record<string, string | null>;
      };
      const canonicalRuntimeSelection = fs.realpathSync(runtimeSelection);
      assert.equal(
        runtimeInputs.hostInputs.includes(canonicalRuntimeSelection),
        true,
      );
      const sameRuntimeFile = (left: string, right: string): boolean => {
        try {
          const a = fs.statSync(left),
            b = fs.statSync(right);
          return a.ino === 0 || b.ino === 0
            ? fs.realpathSync(left) === fs.realpathSync(right)
            : a.dev === b.dev && a.ino === b.ino;
        } catch {
          return false;
        }
      };
      assert.equal(
        runtimeInputs.hostInputs.some((input) =>
          sameRuntimeFile(input, runtimeDescriptorConfig),
        ),
        true,
      );
      for (const absent of [
        canonicalRuntimeSelection.slice(
          0,
          -path.extname(canonicalRuntimeSelection).length,
        ) + ".mts",
        path.join(runtimeDescriptor, "explicit.ts"),
      ]) {
        assert.equal(
          runtimeInputs.hostInputs.includes(absent),
          true,
          JSON.stringify(runtimeInputs),
        );
        assert.equal(runtimeInputs.hostInputHashes[absent], null);
      }
      for (const [directory, basename] of [
        [runtimeProbe, "entry.js"],
        [runtimeOrphan, "tsconfig.json"],
      ] as const) {
        const absent = runtimeInputs.hostInputs.find(
          (input) =>
            path.basename(input) === basename &&
            sameRuntimeFile(path.dirname(input), directory),
        );
        assert.ok(absent, JSON.stringify(runtimeInputs));
        assert.equal(runtimeInputs.hostInputHashes[absent], null);
      }
      const appearedConfig = runtimeInputs.hostInputs.find((input) =>
        sameRuntimeFile(input, runtimeRefreshConfig),
      );
      assert.ok(appearedConfig, JSON.stringify(runtimeInputs));
      assert.equal(
        Object.hasOwn(runtimeInputs.hostInputHashes, appearedConfig),
        false,
        "a config created during evaluation remains unproved",
      );
      assert.equal(
        Object.entries(runtimeInputs.hostInputHashes).some(
          ([input, hash]) =>
            hash === runtimeDescriptorConfigHash &&
            sameRuntimeFile(input, runtimeDescriptorConfig),
        ),
        true,
      );
      const outcomes = await Promise.allSettled(
        workers.map((worker) => worker.request()),
      );
      const assertHostObservation = (reply: LoaderPoolOutcome): void => {
        const observation = reply.hostObservation;
        assert.ok(
          observation,
          "the existing actual delivery must retain its caller event-loop/environment receipt",
        );
        assert.deepEqual(
          observation.after,
          observation.before,
          "native delivery must not change caller TEMP/TMP/TMPDIR",
        );
        assert.ok(
          Number.isFinite(observation.elapsedMs) && observation.elapsedMs >= 0,
        );
        assert.ok(
          Number.isFinite(observation.maximumGapMs) &&
            observation.maximumGapMs >= 0,
        );
        assert.ok(
          Number.isInteger(observation.ticks) && observation.ticks >= 0,
        );
        // This receipt includes the full shared graph's synchronous startup.
        // deadCompilerClaimCorpus separately owns two actual native holds and
        // keeps the original strict 750ms initial/intertick/terminal oracle.
      };
      const failures = outcomes.filter(
        (outcome): outcome is PromiseRejectedResult =>
          outcome.status === "rejected",
      );
      if (failures.length)
        throw new AggregateError(
          failures.map((outcome) => outcome.reason),
          "loader pool outcomes",
        );
      const [metro, turbopack] = outcomes.map((outcome) => {
        const reply = (outcome as PromiseFulfilledResult<LoaderPoolOutcome>)
          .value;
        assertHostObservation(reply);
        assert.equal(reply.error, undefined);
        return reply.value;
      });
      assert.equal(metro.ast.filename, "src/bundle.ts");
      assert.deepEqual(metro.ast.options, {
        projectRoot: workspace.root,
        platform: "ios",
      });
      assert.deepEqual(metro.ast.plugins, ["authored-babel-plugin"]);
      assert.equal(metro.metroConfiguration.withTtscType, "function");
      assert.equal(metro.metroConfiguration.transformType, "function");
      assert.equal(metro.metroConfiguration.getCacheKeyType, "function");
      assert.equal(
        metro.metroConfiguration.transformerPath,
        path.join(lib, "transformer.js"),
      );
      assert.equal(
        path.isAbsolute(metro.metroConfiguration.transformerPath),
        true,
      );
      assert.match(
        metro.metroConfiguration.cacheKey,
        /^[a-f0-9]{64}$/,
        "the actual required CJS artifact must execute getCacheKey; shape alone is not a valid snapshot proof",
      );
      assert.equal(typeof metro.ast.source, "string");
      assert.match(metro.ast.source, /Shared boundary corpus/);
      assert.doesNotMatch(
        metro.ast.source,
        /WRONG ROOT BANNER DECOY/,
        "explicit nested configFile must win over discovered root config",
      );
      assert.match(
        metro.ast.source,
        /Authored source positions remain observable/,
      );
      assert.notEqual(
        metro.ast.source,
        fs.readFileSync(path.join(workspace.root, "src/bundle.ts"), "utf8"),
      );
      assert.doesNotMatch(
        metro.ast.source,
        /STRIPPED_DEBUG_RAN|discard\.call\(\s*\)/,
        "the linked utility host must print the AST after configured stripping",
      );
      assert.doesNotMatch(
        metro.ast.source,
        /logger\.trace\(\s*["']drop["']\s*\)/,
        "the configured custom call must be absent from the linked host printed TypeScript",
      );
      assert.match(
        metro.ast.source,
        /console\.log\(\s*["']DEFAULT_ONLY_RETAINED["']\s*\)/,
        "the configured custom rule must retain the contrary default-only call",
      );
      assert.ok(metro.ast.source.includes("TTSC_BATCH_RESULT"));
      const authoredIdentifier = positionOf(
        fs.readFileSync(path.join(workspace.root, "src/bundle.ts"), "utf8"),
        "authoredMarker",
      );
      assert.ok(
        metro.ast.shifted > authoredIdentifier.line + 1,
        "the independently authored banner shifts the upstream identifier before Metro remaps it",
      );
      const identifierLocation = metro.ast.program.body[0].loc;
      assert.deepEqual(identifierLocation.start, {
        line: authoredIdentifier.line + 1,
        column: authoredIdentifier.column,
      });
      assert.ok(
        identifierLocation.end.line === authoredIdentifier.line + 1 &&
          identifierLocation.end.column >= authoredIdentifier.column,
        "the remapped end stays on the authored line at or after its start",
      );
      assert.equal(metro.outsideProgram.filename, "passthrough/tool.ts");
      assert.equal(
        metro.outsideProgram.source.replace(/\r\n/g, "\n"),
        "export const outsideProgram: number = 1;\n",
        "the actual built adapter must forward an excluded source unchanged without substituting the program's output",
      );
      assert.equal(turbopack.completions, 1);
      assert.deepEqual(turbopack.errors, []);
      assert.deepEqual(
        turbopack.cacheability,
        [],
        "an ordinary native result must not invoke the actual cacheable(false) volatility callback",
      );
      assert.equal(turbopack.value, "authored-marker");
      assert.ok(
        turbopack.map,
        "the linked host must deliver its owned authored map through the actual loader callback",
      );
      const mapMarker = '"authored-marker"';
      const generatedMapPosition = positionOf(turbopack.content, mapMarker);
      assert.ok(
        generatedMapPosition.line >
          positionOf(originalDelivered[1]!, mapMarker).line,
        "the actual banner must shift the generated marker before its map returns to authored coordinates",
      );
      const originalMapPosition = originalPositionFor(
        turbopack.map,
        generatedMapPosition.line,
        generatedMapPosition.column,
      );
      assert.ok(originalMapPosition);
      assert.match(originalMapPosition.source, /map\.ts$/);
      assert.deepEqual(
        { line: originalMapPosition.line, column: originalMapPosition.column },
        positionOf(originalDelivered[1]!, mapMarker),
      );
      assert.equal(
        turbopack.map.sourcesContent[
          turbopack.map.sources.indexOf(originalMapPosition.source)
        ].replace(/\r\n/g, "\n"),
        originalDelivered[1]!.replace(/\r\n/g, "\n"),
      );
      assert.equal(
        turbopack.dependencies.length,
        1,
        "the real loader must hand over only the project's record",
      );
      assert.deepEqual(turbopack.contextDependencies, []);
      const projectRecordFile = turbopack.dependencies[0]!;
      assert.equal(
        path.dirname(projectRecordFile),
        path.join(workspace.root, ".ttsc", "records"),
      );
      const record = JSON.parse(fs.readFileSync(projectRecordFile, "utf8"));
      assert.equal(record.root, fs.realpathSync.native(workspace.root));
      assert.equal(
        record.tsconfig,
        fs.realpathSync.native(path.join(workspace.root, "tsconfig.json")),
      );
      for (const input of [
        fs.realpathSync.native(
          path.join(workspace.root, "config/banner.config.json"),
        ),
        fs.realpathSync.native(
          path.join(workspace.root, "config/strip.config.json"),
        ),
        fs.realpathSync.native(path.join(workspace.root, "src/console.d.ts")),
      ])
        assert.ok(
          Object.prototype.hasOwnProperty.call(record.inputs, input),
          `the actual record must carry ${input}`,
        );
      assert.ok(
        Object.prototype.hasOwnProperty.call(
          record.inputs,
          path.join(workspace.root, "src/pool-routing/tsconfig.json"),
        ),
        "the implicit loader selection must retain the files-empty solution that routed to the native root project",
      );
      for (const input of descriptorInputs) {
        const evidence = record.inputs[input];
        assertDescriptorBytes(input, evidence, descriptorBytes.get(input)!);
      }
      const automaticEntryCandidates = Object.keys(record.inputs).filter(
        (input) =>
          input.includes(path.join("node_modules", "batch-auto-discovery")),
      );
      assert.deepEqual(
        automaticEntryCandidates.filter(
          (input) => !input.startsWith(workspace.root + path.sep),
        ),
        [],
        "the selected automatic plugin entry must not record search roots beyond its installed package",
      );
      assert.deepEqual(
        Object.keys(record.inputs).filter(
          (input) =>
            input.includes(path.join("node_modules", "#local-descriptor")) ||
            input.includes(path.join("node_modules", "#installed-descriptor")),
        ),
        [],
        "package imports must not invent bare-package search paths for the internal import names",
      );
      assert.deepEqual(
        Object.keys(record.inputs).filter(
          (input) =>
            input.includes(
              path.join("node_modules", "batch-descriptor-input"),
            ) && !input.startsWith(workspace.root + path.sep),
        ),
        [],
        "the successful mapped package must not retain candidates beyond its selected root",
      );
      const phantomDescriptorPackage = path.join(
        workspace.root,
        "descriptors/node_modules/batch-descriptor-input/package.json",
      );
      assert.equal(fs.existsSync(phantomDescriptorPackage), false);
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          record.inputs,
          phantomDescriptorPackage,
        ),
        false,
        "a package imports bare target is resolved from the package scope, not a nearer descriptor-directory node_modules",
      );
      for (const missingDescriptor of [
        path.join(workspace.root, "descriptors/optional.cjs"),
        path.join(
          workspace.root,
          "node_modules/batch-absent-descriptor-input/package.json",
        ),
      ]) {
        assert.equal(
          fs.existsSync(missingDescriptor),
          false,
          "the failed internal import target remains independently absent",
        );
        assert.ok(
          Object.prototype.hasOwnProperty.call(
            record.inputs,
            missingDescriptor,
          ),
          "the real descriptor recorder must retain the failed mapped import target: " +
            missingDescriptor,
        );
        assert.equal(record.inputs[missingDescriptor].missing, true);
      }
      const initialNativeCalls =
        fs.statSync(workspace.programRunLog).size - baseline;
      assert.equal(
        initialNativeCalls,
        1,
        "one actual native ApplyProgram invocation serves the two-worker pool; actual initial capture observations: " +
          JSON.stringify({
            nativeCalls: initialNativeCalls,
            callerOptions: [metro.requestedOptions, turbopack.requestedOptions],
            adapterCalls: [metro.adapterCalls, turbopack.adapterCalls],
            contextReceipts:
              BatchWorkspace.readContextReceipts(workspace).slice(
                receiptOffset,
              ),
            configPathReceipts: fs
              .readFileSync(workspace.configPathReceipt, "utf8")
              .split(/\r?\n/)
              .filter(Boolean)
              .map((line) => JSON.parse(line)),
            casePolicyReceipts: fs
              .readFileSync(workspace.casePolicyReceipt, "utf8")
              .split(/\r?\n/)
              .filter(Boolean)
              .slice(caseOffset)
              .map((line) => JSON.parse(line)),
            recordConfig: record.tsconfig,
            declaredInputs: Object.keys(record.inputs).sort(),
            invocationTrace: fs
              .readdirSync(traceRoot)
              .filter((name) => name.endsWith(".jsonl"))
              .flatMap((name) =>
                fs
                  .readFileSync(path.join(traceRoot, name), "utf8")
                  .split(/\r?\n/)
                  .filter(Boolean)
                  .map((line) => JSON.parse(line)),
              )
              .filter((row) =>
                [
                  "bridge-lookup",
                  "bridge-cache-hit",
                  "bridge-result",
                  "bridge-generation-proof",
                  "bridge-publication",
                  "bridge-attempt-disposition",
                  "integrity-failure",
                ].includes(row.event),
              ),
          }),
      );
      const initialPublications = fs
        .readdirSync(session)
        .filter((name) => name.endsWith(".json"))
        .map((name) =>
          JSON.parse(fs.readFileSync(path.join(session, name), "utf8")),
        );
      assert.equal(
        initialPublications.length,
        1,
        "the two actual deliveries share one published native envelope",
      );
      const initialEnvelope = initialPublications[0]!.result;
      assert.equal(initialEnvelope.type, "success");
      const envelopePath = (file: string) =>
        path.resolve(workspace.root, file).replace(/\\/g, "/");
      // Completeness is the intersection of every applicable native contributor.
      // The selected paths contributor does not declare completeness; explicit
      // fixture reports therefore cannot certify the whole linked Program.
      assert.equal(
        Object.hasOwn(initialEnvelope, "dependenciesComplete"),
        false,
        "an unreporting linked contributor must keep the native envelope conservative",
      );
      for (const file of [
        "src/bundle.ts",
        "src/map.ts",
        "src/pool-routing/map.ts",
      ])
        assert.ok(
          Object.keys(initialEnvelope.typescript).some(
            (source) => envelopePath(source) === envelopePath(file),
          ),
          "the reporter's configured source must be in this actual transformed Program: " +
            file,
        );
      assert.ok(
        Object.keys(initialEnvelope.typescript).some(
          (file) =>
            envelopePath(file) === envelopePath("src/native-pipeline.ts"),
        ),
        "the unmarked sibling must be an actual transformed source, not an invented metadata path",
      );
      assert.equal(
        fs.readFileSync(nonInputRaceFile, "utf8"),
        nonInputRaceContent,
        "the actual native hook must perform its ignored write during capture",
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(record.inputs, nonInputRaceFile),
        false,
        "the non-input write must not become a declared native input",
      );
      BatchWorkspace.assertContextReceipts(
        BatchWorkspace.readContextReceipts(workspace).slice(receiptOffset),
      );
      const caseReports = fs
        .readFileSync(workspace.casePolicyReceipt, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(caseOffset)
        .map((line) => JSON.parse(line));
      const nativeCase = caseReports.find(
        (report) => report.name === "shared-real-program-probe",
      )?.useCaseSensitiveFileNames;
      assert.equal(
        typeof nativeCase,
        "boolean",
        "the initial actual Program must report its native comparison policy",
      );
      assert.equal(rootCase, nativeCase);
      assert.equal(
        siblingCase,
        nativeCase,
        "both actual-platform cache-root queries must agree with this Program's native comparison policy",
      );
      finalRecord = projectRecordFile;
      for (const input of [declaration, candidate])
        assert.ok(
          Object.prototype.hasOwnProperty.call(record.inputs, input),
          `native resolution must record ${input}`,
        );
      assert.ok(
        record.membership !== null,
        "the real record carries project membership",
      );
      for (const alias of ["native-source-first", "native-source-second"])
        assert.ok(
          Object.hasOwn(
            record.inputs,
            path.join(workspace.root, alias, "map.ts"),
          ),
          "the actual native reported dependency must retain each independently retargetable lexical alias",
        );
      const signal = () => fs.readFileSync(projectRecordFile, "utf8");
      const quiet = async (message: string) => {
        const before = signal();
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        assert.equal(signal(), before, message);
      };
      const signalBeforeEdit = signal();
      const metadataProgramBaseline = fs.statSync(workspace.programRunLog).size;
      // These inputs have no conflicting values or configuration requirements.
      // One invalidated generation can consume the compiler and descriptor changes together.
      fs.appendFileSync(
        declaration,
        "export declare const retainedMetadata: 1;\n",
      );
      const candidateSource =
        "export interface RecordWitness { label: string; native?: 1 }\n";
      const membershipSource = "declare const pooledMembership: 1;\n";
      fs.writeFileSync(candidate, candidateSource);
      fs.writeFileSync(addedRoot, membershipSource);
      const changedDescriptorSource =
        'module.exports = "installed-descriptor-input";\n// changed selected descriptor input\n';
      const optionalSource = 'module.exports = "appeared-descriptor-input";\n';
      fs.writeFileSync(installedDescriptor, changedDescriptorSource);
      fs.writeFileSync(optionalDescriptor, optionalSource);
      const metadataBanner = JSON.stringify({
        text: "Shared metadata external-input banner",
      });
      fs.writeFileSync(bannerPath, metadataBanner);
      await waitFor(
        () => signal() !== signalBeforeEdit,
        "the resident record to move for the combined native input epoch",
      );
      const firstSignal = signal();
      await waitFor(
        () => signal() !== firstSignal,
        "the same resident record to repeat its unacknowledged move",
      );
      const metadataDelivery = await Promise.all(
        workers.map((worker) => worker.request()),
      );
      for (const reply of metadataDelivery) assertHostObservation(reply);
      for (const reply of metadataDelivery)
        assert.equal(reply.error, undefined);
      assert.match(
        metadataDelivery[0]!.value.ast.source,
        /Shared metadata external-input banner/,
      );
      assert.match(
        metadataDelivery[1]!.value.content,
        /Shared metadata external-input banner/,
      );
      assert.match(metadataDelivery[0]!.value.ast.source, /"authored-marker"/);
      assert.equal(metadataDelivery[1]!.value.value, "authored-marker");
      for (let index = 0; index < deliveredPaths.length; index++)
        assert.equal(
          fs.readFileSync(deliveredPaths[index]!, "utf8"),
          originalDelivered[index],
          "the native external-read epoch must update output without changing either delivered entry",
        );
      assert.equal(
        fs.statSync(workspace.programRunLog).size - metadataProgramBaseline,
        1,
        "one native ApplyProgram admission consumes the combined declaration, candidate, membership and descriptor appearance epoch",
      );
      assert.deepEqual(metadataDelivery[1]!.value.dependencies, [
        projectRecordFile,
      ]);
      const acknowledged = JSON.parse(signal());
      for (const input of [declaration, candidate, addedRoot])
        assert.ok(
          Object.prototype.hasOwnProperty.call(acknowledged.inputs, input),
          `the same native delivery must acknowledge ${input}`,
        );
      for (const [input, authored] of [
        [installedDescriptor, changedDescriptorSource],
        [optionalDescriptor, optionalSource],
        [bannerPath, metadataBanner],
      ]) {
        const evidence = acknowledged.inputs[input!];
        assertDescriptorBytes(input!, evidence, authored!);
      }
      assert.equal(
        fs.readFileSync(declaration, "utf8"),
        originalDeclaration.toString("utf8") +
          "export declare const retainedMetadata: 1;\n",
      );
      assert.equal(fs.readFileSync(candidate, "utf8"), candidateSource);
      assert.equal(fs.readFileSync(addedRoot, "utf8"), membershipSource);
      await quiet(
        "one delivery that consumed the combined epoch settles the actual record",
      );
      fs.writeFileSync(unrelatedPackageFile, "unrelated package bytes\n");
      await quiet(
        "unrelated package content does not move the acknowledged record",
      );
      for (const dependency of turbopack.dependencies) {
        assert.ok(fs.existsSync(dependency));
        const relative = path.relative(workspace.root, dependency);
        assert.equal(
          relative.startsWith("..") || path.isAbsolute(relative),
          false,
        );
        assert.notEqual(dependency, path.join(workspace.root, "src/map.ts"));
      }
      assert.equal(
        turbopack.content.replace(/\r\n/g, "\n"),
        fs
          .readFileSync(
            path.join(workspace.root, "expected-map-source.txt"),
            "utf8",
          )
          .replace(/\r\n/g, "\n"),
        "the linked utility host must preserve the independently authored full banner and TypeScript output alongside its authored map",
      );
      const publications = () =>
        fs
          .readdirSync(session)
          .filter((name) => name.endsWith(".json"))
          .sort()
          .map((name) => {
            const value = JSON.parse(
              fs.readFileSync(path.join(session, name), "utf8"),
            );
            return {
              name,
              type: value.result.type,
              scratchDirectory: value.scratchDirectory,
            };
          });
      const failureTrace = (): Record<string, unknown[]> =>
        Object.fromEntries(
          fs
            .readdirSync(traceRoot)
            .filter((name) => name.endsWith(".jsonl"))
            .sort()
            .map((name) => [
              name,
              fs
                .readFileSync(path.join(traceRoot, name), "utf8")
                .split(/\r?\n/)
                .filter(Boolean)
                .map((line) => JSON.parse(line)),
            ]),
        );
      const failureTraceOffsets = Object.fromEntries(
        Object.entries(failureTrace()).map(([name, rows]) => [
          name,
          rows.length,
        ]),
      );
      // These state transitions keep the same two actual adapter/cache owners.
      fs.appendFileSync(
        contractPath,
        '\nexport type PooledBroken = NotARealExternalType;\nexport const pooledAliasInvalid: import("@typed/foo").Foo = { id: "wrong", name: 42 };\n',
      );
      const healthyDeclaration = fs.readFileSync(declaration);
      fs.appendFileSync(
        declaration,
        "export type PooledExternalBroken = NotARealExternalType;\n",
      );
      const failed = await Promise.all(
        workers.map((worker) => worker.request()),
      );
      for (const [index, reply] of failed.entries()) {
        assertHostObservation(reply);
        assert.match(reply.error ?? "", /NotARealExternalType/);
        assert.match(
          reply.error ?? "",
          /not assignable/,
          "the independently typed alias cannot collapse to any through a wrapper",
        );
        assert.match(
          reply.error ?? "",
          /contract\.ts/,
          "the public diagnostic must name its actual failed source",
        );
        assert.match(
          reply.error ?? "",
          /index\.d\.ts/,
          "the real declaration outside project discovery must also reach the diagnostic",
        );
        assert.doesNotMatch(
          reply.error ?? "",
          /\x1b\[/,
          "the adapter exception must remain a plain host diagnostic",
        );
        assert.equal(
          reply.adapterCalls?.[0]?.outcome,
          index === 0 ? "threw" : "returned",
          "Metro throws the compile failure; Turbopack completes its error-module callback before evaluation rejects",
        );
        assert.equal(typeof reply.adapterCalls?.[0]?.finishedAt, "string");
      }
      assert.equal(
        failed[1]!.callbackObservation?.completions,
        1,
        "the same failed native delivery must settle the actual Turbopack callback once",
      );
      assert.equal(
        failed[1]!.callbackObservation?.errors.length,
        1,
        "Turbopack must emit the native compile error before returning its failed module",
      );
      assert.match(
        failed[1]!.callbackObservation!.errors[0]!,
        /NotARealExternalType/,
      );
      assert.match(
        failed[1]!.callbackObservation!.errors[0]!,
        /not assignable/,
      );
      assert.match(failed[1]!.callbackObservation!.errors[0]!, /contract\.ts/);
      assert.match(failed[1]!.callbackObservation!.errors[0]!, /index\.d\.ts/);
      assert.doesNotMatch(failed[1]!.callbackObservation!.errors[0]!, /\x1b\[/);
      assert.ok(
        Object.hasOwn(JSON.parse(signal()).inputs, declaration),
        "the actual record channel retains the reached declaration whose repair changes this failure",
      );
      const failedPublications = publications();
      assert.equal(
        failedPublications.filter(
          (publication) => publication.type === "failure",
        ).length,
        1,
        "one reusable failed publication must serve the two existing callers; actual failed epoch: " +
          JSON.stringify({
            publications: failedPublications,
            replies: failed,
            record: JSON.parse(signal()),
            invocationTrace: Object.entries(failureTrace()).flatMap(
              ([name, rows]) =>
                rows
                  .slice(failureTraceOffsets[name] ?? 0)
                  .map((event) => ({ file: name, event })),
            ),
          }),
      );
      const replay = await Promise.all(
        workers.map((worker) => worker.request()),
      );
      for (const reply of replay) {
        assertHostObservation(reply);
        assert.match(reply.error ?? "", /NotARealExternalType/);
        assert.match(reply.error ?? "", /not assignable/);
      }
      assert.deepEqual(
        publications(),
        failedPublications,
        "both residents reuse the failed publication without publishing another compile",
      );
      fs.writeFileSync(contractPath, originalContract);
      fs.writeFileSync(declaration, healthyDeclaration);
      const repaired = await Promise.all(
        workers.map((worker) => worker.request()),
      );
      for (const reply of repaired) assertHostObservation(reply);
      const repairFailure = repaired.some((reply) => reply.error !== undefined)
        ? JSON.stringify({
            repaired,
            inputs: [contractPath, declaration].map((file, index) => ({
              file,
              expectedHash: crypto
                .createHash("sha256")
                .update(index === 0 ? originalContract : healthyDeclaration)
                .digest("hex"),
              actualHash: crypto
                .createHash("sha256")
                .update(fs.readFileSync(file))
                .digest("hex"),
            })),
            publications: publications(),
            // The worker-owned sink is removed only after joined close below.
            // Preserve its actual failed epoch in the assertion before cleanup.
            invocationTrace: Object.entries(failureTrace()).flatMap(
              ([name, rows]) =>
                rows
                  .slice(failureTraceOffsets[name] ?? 0)
                  .map((event) => ({ file: name, event })),
            ),
          })
        : undefined;
      for (const reply of repaired) {
        assert.equal(reply.error, undefined, repairFailure);
        assert.ok(reply.value);
      }
      assert.equal(
        repaired[0]!.value.ast.source,
        metadataDelivery[0]!.value.ast.source,
        "repair restores the actual pre-failure Metro native output of this input epoch",
      );
      assert.equal(
        repaired[1]!.value.content,
        metadataDelivery[1]!.value.content,
        "repair restores the actual pre-failure Turbopack native output of this input epoch",
      );
      assert.ok(
        publications().some((publication) => publication.type === "success"),
        "repair observes an actual successful publication",
      );
      fs.writeFileSync(
        bannerPath,
        JSON.stringify({
          text: "Pooled second banner\nIndependent external-config state",
        }),
      );
      // Disk-source and external configuration changes coexist in this already
      // required epoch. The caller still delivers the previous source bytes.
      for (let index = 0; index < deliveredPaths.length; index++) {
        assert.match(originalDelivered[index]!, /"authored-marker"/);
        fs.writeFileSync(
          deliveredPaths[index]!,
          originalDelivered[index]!.replace(
            '"authored-marker"',
            '"disk-drifted-marker"',
          ),
        );
      }
      const divergentSuffix =
        "\n// changed by the host before native delivery\n";
      const external = await Promise.all(
        workers.map((worker, index) =>
          worker.request("", originalDelivered[index]),
        ),
      );
      for (const reply of external) {
        assert.equal(reply.error, undefined);
        assert.ok(reply.value);
      }
      assert.match(external[0]!.value.ast.source, /Pooled second banner/);
      assert.doesNotMatch(
        external[0]!.value.ast.source,
        /Shared boundary corpus/,
      );
      assert.doesNotMatch(
        external[0]!.value.ast.source,
        /Shared metadata external-input banner/,
      );
      assert.match(external[0]!.value.ast.source, /"disk-drifted-marker"/);
      assert.doesNotMatch(external[0]!.value.ast.source, /"authored-marker"/);
      assert.equal(
        external[1]!.value.value,
        "disk-drifted-marker",
        "native output must use disk bytes rather than stale delivered text",
      );
      const changedExternal = publications();
      const beforeIgnoredChurn = fs.statSync(workspace.programRunLog).size;
      fs.writeFileSync(
        unrelatedPath,
        "Unrelated text is not a resolution/config input.\n",
      );
      fs.mkdirSync(path.dirname(ignoredOutput), { recursive: true });
      fs.writeFileSync(
        ignoredOutput,
        "console.log('hashed generated output');\n",
      );
      const externalReplay = await Promise.all(
        workers.map((worker) => worker.request(divergentSuffix)),
      );
      for (const reply of externalReplay) assert.equal(reply.error, undefined);
      assert.equal(
        externalReplay[0]!.value.ast.source,
        external[0]!.value.ast.source,
      );
      assert.equal(
        externalReplay[1]!.value.content,
        external[1]!.value.content,
      );
      assert.equal(externalReplay[1]!.value.value, "disk-drifted-marker");
      assert.deepEqual(external[1]!.value.dependencies, [projectRecordFile]);
      assert.deepEqual(
        externalReplay[1]!.value.dependencies,
        [projectRecordFile],
        "a cache delivery must repeat the real project-record handoff",
      );
      assert.deepEqual(external[1]!.value.contextDependencies, []);
      assert.deepEqual(externalReplay[1]!.value.contextDependencies, []);
      assert.deepEqual(external[1]!.value.cacheability, []);
      assert.deepEqual(
        externalReplay[1]!.value.cacheability,
        [],
        "unchanged ordinary cache delivery must not invent volatility",
      );
      assert.deepEqual(
        publications(),
        changedExternal,
        "unrelated candidate-directory and excluded output churn keep the publication",
      );
      assert.equal(
        fs.statSync(workspace.programRunLog).size,
        beforeIgnoredChurn,
        "ignored churn does not invoke native ApplyProgram again",
      );
      // All three transitions affect only this experiment's subtree of the actual
      // excluded outDir. The next existing delivery must retain the publication
      // even if an observer accumulated any of these directory events.
      for (let revision = 0; revision < 3; ++revision) {
        fs.rmSync(recreatedOutputDirectory, { recursive: true, force: true });
        fs.mkdirSync(recreatedOutputDirectory, { recursive: true });
        fs.writeFileSync(
          path.join(recreatedOutputDirectory, `bundle-${revision}.js`),
          `export const revision = ${revision};\n`,
        );
      }
      const repeatedDivergence = await Promise.all(
        workers.map((worker) => worker.request(divergentSuffix)),
      );
      for (const reply of repeatedDivergence)
        assert.equal(reply.error, undefined);
      assert.equal(
        repeatedDivergence[0]!.value.ast.source,
        external[0]!.value.ast.source,
      );
      assert.equal(
        repeatedDivergence[1]!.value.content,
        external[1]!.value.content,
      );
      assert.equal(repeatedDivergence[1]!.value.value, "disk-drifted-marker");
      assert.deepEqual(repeatedDivergence[1]!.value.dependencies, [
        projectRecordFile,
      ]);
      assert.deepEqual(repeatedDivergence[1]!.value.contextDependencies, []);
      assert.deepEqual(repeatedDivergence[1]!.value.cacheability, []);
      assert.deepEqual(
        publications(),
        changedExternal,
        "recreated excluded output directories and repeated divergent host text preserve the native generation",
      );
      assert.equal(
        fs.statSync(workspace.programRunLog).size,
        beforeIgnoredChurn,
      );
    } catch (error) {
      bodyFailure = error;
    } finally {
      const closes = await Promise.allSettled(
        workers.map((worker) => worker.close()),
      );
      const failedCloses = closes.filter(
        (entry): entry is PromiseRejectedResult => entry.status === "rejected",
      );
      const failures: unknown[] = [
        ...publicApiFailures,
        ...failedCloses.map((entry) => entry.reason),
      ];
      if (failedCloses.length === 0) {
        // A timed-out delivery may still be reading these inputs. Restore only
        // after both real adapter owners have joined; uncertain closure retains
        // the epoch and its original failure instead of changing live inputs.
        fs.writeFileSync(contractPath, originalContract);
        fs.writeFileSync(bannerPath, originalBanner);
        for (let index = 0; index < deliveredPaths.length; index++)
          fs.writeFileSync(deliveredPaths[index]!, originalDelivered[index]!);
        fs.writeFileSync(declaration, originalDeclaration);
        for (const owned of [candidate, unrelatedPackageFile, addedRoot])
          fs.rmSync(owned, { force: true });
        fs.rmSync(unrelatedPath, { force: true });
        fs.rmSync(ignoredOutput, { force: true });
        fs.rmSync(recreatedOutputDirectory, { recursive: true, force: true });
        if (bodyFailure === undefined)
          fs.rmSync(pluginLockRoot, { recursive: true });
        try {
          assert.match(
            workers[0]!.diagnostics(),
            /DESCRIPTOR_STDOUT_MARKER loaded/,
          );
          assert.equal(
            /factory-env:ambient|absent-ambient/.test(
              workers[0]!.diagnostics(),
            ),
            false,
          );
          const lintStderr = workers[0]!.diagnostics();
          for (const marker of [
            "loading executable lint config",
            "executable lint config warning",
            "loading mjs lint config",
          ])
            assert.equal(
              lintStderr.split(marker).length - 1,
              3,
              "each changed healthy graph retains its real evaluator log: " +
                marker,
            );
          for (const marker of [
            "loading JSON contributor",
            "JSON contributor warning",
            "failed config stdout",
            "failed config stderr",
          ])
            assert.equal(
              lintStderr.split(marker).length - 1,
              1,
              "real package/failure logs survive only on the joined stderr channel: " +
                marker,
            );
        } catch (error) {
          failures.push(error);
        }
        assert.equal(path.dirname(descriptorFailureRoot), workspace.root);
        if (bodyFailure === undefined && failures.length === 0) {
          fs.rmSync(descriptorFailureRoot, { recursive: true });
          // The joined offline-restart phase keeps this same trace epoch.
        }
        fs.writeFileSync(configPath, originalConfig);
        fs.rmSync(nonInputRaceFile, { force: true });
        fs.rmSync(optionalDescriptor, { force: true });
        fs.writeFileSync(installedDescriptor, originalInstalledDescriptor);
      }
      if (bodyFailure === undefined && failedCloses.length === 0)
        try {
          assert.ok(
            finalRecord !== undefined && fs.existsSync(finalRecord),
            "joined worker close retains the real record for later sessions",
          );
        } catch (error) {
          failures.push(error);
        }
      if (bodyFailure === undefined && failedCloses.length === 0)
        for (const worker of workers) {
          try {
            assert.equal(
              worker.diagnostics().split("differs from the file on disk")
                .length - 1,
              1,
              "each real resident reports divergent delivery once",
            );
          } catch (error) {
            failures.push(error);
          }
        }
      if (bodyFailure === undefined && failures.length === 0) {
        // Reuse the retained publication without any live former adapter owner.
        // An offline edit must defeat its stale content in a genuinely fresh
        // Metro worker, not merely the old worker's in-memory revalidation.
        const source = deliveredPaths[0]!;
        const original = originalDelivered[0]!;
        assert.match(original, /"authored-marker"/);
        const ticksBeforeRestart = fs.statSync(workspace.programRunLog).size;
        fs.writeFileSync(
          source,
          original.replace('"authored-marker"', '"offline-restart-marker"'),
        );
        fs.mkdirSync(traceRoot, { recursive: true });
        let restarted: ReturnType<typeof createLoaderPoolWorker> | undefined;
        let restartJoined = false;
        try {
          restarted = createLoaderPoolWorker({
            mode: "metro",
            root: workspace.root,
            cache: workspace.cache,
            session: session + "-offline-restart",
            traceRoot,
            metro: pathToFileURL(path.join(lib, "transformer.js")).href,
            turbopack: TestUnpluginRuntime.libUrl("turbopack"),
          });
          const reply = await restarted.request();
          assert.equal(reply.error, undefined);
          assert.ok(reply.value !== undefined);
          assert.match(reply.value.ast.source, /offline-restart-marker/);
          assert.doesNotMatch(
            reply.value.ast.source,
            /["']authored-marker["']/,
          );
          assert.equal(
            fs.statSync(workspace.programRunLog).size,
            ticksBeforeRestart + 1,
            "one fresh native probe invocation must validate the offline-edited generation",
          );
        } catch (error) {
          failures.push(error);
        } finally {
          try {
            if (restarted !== undefined) {
              await restarted.close();
              restartJoined = true;
            }
          } catch (error) {
            failures.push(error);
          }
          if (restartJoined) {
            try {
              fs.writeFileSync(source, original);
              // Exit cleanup releases successful traces after the entire batch.
            } catch (error) {
              failures.push(error);
              BatchWorkspace.retain(
                "fresh Metro restoration failed after closure",
              );
            }
          } else
            BatchWorkspace.retain(
              "fresh Metro adapter closure unresolved; offline input retained",
            );
        }
      }
      if (bodyFailure !== undefined) failures.unshift(bodyFailure);
      if (failures.length)
        throw new AggregateError(
          failures,
          "resident loader pool delivery and close",
        );
    }
  } catch (error) {
    try {
      TestProject.retainTemporaryDirectory(
        traceRoot,
        "Metro loader-pool failure retains native argv/key/terminal observations",
      );
      console.error("Metro loader-pool observations retained: " + traceRoot);
    } catch (retentionError) {
      throw new AggregateError(
        [error, retentionError],
        "Metro loader-pool failure and observation retention",
      );
    }
    throw error;
  }
}
