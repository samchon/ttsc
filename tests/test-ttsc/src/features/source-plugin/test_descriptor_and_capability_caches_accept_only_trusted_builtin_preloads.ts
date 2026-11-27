import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { TtsxNodeOptions } from "../../../../../packages/ttsc/src/internal/TtsxNodeOptions";
import { CapabilityResolutionFormat } from "../../../../../packages/ttsc/src/plugin/internal/CapabilityResolutionFormat";
import { PluginDescriptorEvaluationCache } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginDescriptorEvaluationCache";
import { TestProject } from "../../../../utils/src/TestProject";

interface IActorReport {
  descriptorLocation: string | null;
  descriptorCacheHit: boolean;
  descriptorEvaluated: boolean;
  descriptorInputs: string[];
  descriptorObservationsComplete: boolean | null;
  descriptorReadFailure?: string;
  descriptorWriteAttempted: boolean;
  descriptorDifferentGraphRefused: boolean;
  descriptorDifferentNodePathRefused: boolean;
  descriptorDifferentHomeRefused?: boolean;
  capabilities: {
    bun: boolean;
    executable?: string;
    registerHooks: boolean;
  };
  capabilityProbes: number;
  alternateCapabilities?: IActorReport["capabilities"];
  alternateHomeCapabilities?: IActorReport["capabilities"];
  alternateHomeProbes?: number;
  resolutionFile: string | null;
  runtimeProved: boolean | null;
  capabilityAuthority: string | null;
  capabilityCacheHit: boolean | null;
  capabilityIsCurrent: boolean;
  runtimeAuthorityReason: string | null;
}

/**
 * Verifies descriptor, runtime-capability and capability-resolution caches
 * observe and digest only trusted `--require`/`-r` preload module graphs.
 *
 * A workspace sandbox can set `NODE_OPTIONS=--require=<preload>` on every
 * process. Caching stays enabled when each `-r`/`--require` root's exact
 * physical path is listed in `TTSC_CACHE_TRUSTED_PRELOADS` and its live
 * `require.cache` `module.children` graph is observable, while missing on any
 * root or transitive dependency edit, refusing untrusted preloads and
 * `--import`, and isolating user preload graphs from `runtimeHookPreload`.
 *
 * 1. Run two launches under a trusted port-zero-like preload and verify hits
 *    across all three caches, then verify untrusted preloads and globs refuse.
 * 2. Edit the trusted preload's bytes and verify all three caches miss.
 * 3. Load a trusted preload requiring a local helper file, verify hits across
 *    launches and misses when its bytes or resolution change. Verify `--import`
 *    refuses, and verify a `ttsx`-like child with `runtimeHookPreload` records
 *    only the user graph.
 * 4. Check separate Node search contexts for alternate child home and working
 *    directories.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Node launches run the descriptor evaluator shim, PluginDescriptorEvaluationCache.locate/read/write, javascriptRuntimeCapabilities and resolveCapabilityPluginResolution with real preloads, local dependencies and runtimeHookPreload.
 * @evidence contracts/testing.md#independent-expectations Expected hits, misses, probe counts, recorded input graphs and null refusals follow directly from the observed-graph preload contract and real child execution.
 * @evidence contracts/testing.md#distinguishing-cases Covers trusted preload hits, untrusted and glob refusal, startup graph disagreement, preload and helper edits, a new resolution candidate with previous files unchanged, before-read invalidation, ttsx-like graph isolation, relative and package lookup, the fixture's package-scope boundary, NODE_PATH and home directory mismatches, missing roots, unsupported flags and empty options.
 * @evidence contracts/testing.md#execution-ownership Unit test owning temp files and fresh Node source actors through register-unit-loader.mjs without building native artifacts, installing consumers or starting a product host.
 */
export function test_descriptor_and_capability_caches_accept_only_trusted_builtin_preloads(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-trusted-preload-cache-"),
  );
  const cacheDir = path.join(root, "cache");
  const projectDir = path.join(root, "project");
  const preloadDir = path.join(root, "preloads");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(preloadDir, { recursive: true });
  // The preload helper's type is determined by this owned scope. Proving a
  // missing manifest in the shared system temp directory would depend on
  // metadata changed by any other process creating a temporary file there.
  const fixtureManifest = path.join(root, "package.json");
  fs.writeFileSync(fixtureManifest, '{"type":"commonjs"}');

  const tsconfig = "tsconfig.json";
  const pluginFile = path.join(projectDir, "plugin.cjs");
  fs.writeFileSync(
    path.join(projectDir, tsconfig),
    JSON.stringify({ compilerOptions: {} }),
  );
  fs.writeFileSync(
    path.join(projectDir, "package.json"),
    JSON.stringify({ name: "trusted-preload-fixture" }),
  );
  fs.writeFileSync(
    pluginFile,
    'module.exports = { name: "trusted-preload-fixture", hostInputHashes: {} };\n',
  );

  // Fixture 1: port-zero-like CJS preload.
  const portZeroFile = path.join(preloadDir, "port-zero.cjs");
  const portZeroSourceV1 = [
    '"use strict";',
    'const { isMainThread } = require("node:worker_threads");',
    'const net = require("node:net");',
    'const childProcess = require("node:child_process");',
    'const tcp = process.binding("tcp_wrap");',
    "if (isMainThread && net && childProcess && tcp && process.env.PORT_ZERO_MODE) {",
    "  void process.env.PORT_ZERO_MODE;",
    "}",
    "",
  ].join("\n");
  fs.writeFileSync(portZeroFile, portZeroSourceV1);
  const portZeroReal = fs.realpathSync.native(portZeroFile);

  // Fixture 2: trusted preload requiring a local helper module.
  const localHelperFile = path.join(preloadDir, "local-helper.js");
  const localHelperV1 = "module.exports = { version: 1 };\n";
  fs.writeFileSync(localHelperFile, localHelperV1);
  const localHelperReal = fs.realpathSync.native(localHelperFile);

  const preloadWithLocalFile = path.join(preloadDir, "with-local.cjs");
  fs.writeFileSync(
    preloadWithLocalFile,
    'const helper = require("./local-helper");\nvoid helper.version;\n',
  );
  const preloadWithLocalReal = fs.realpathSync.native(preloadWithLocalFile);

  // Fixture 3: ESM --import preload (must refuse even when trusted).
  const esmPreloadFile = path.join(preloadDir, "esm-preload.mjs");
  fs.writeFileSync(
    esmPreloadFile,
    'import path from "node:path";\nvoid path;\n',
  );
  const esmPreloadReal = fs.realpathSync.native(esmPreloadFile);

  // Fixture 4: extra untrusted CJS preload.
  const extraUntrustedFile = path.join(preloadDir, "extra-untrusted.cjs");
  fs.writeFileSync(extraUntrustedFile, 'require("node:path");\n');

  const actor = fileURLToPath(
    new URL("../../internal/trusted-preload-cache-actor.ts", import.meta.url),
  );
  const loader = new URL(
    "../../../../../config/register-unit-loader.mjs",
    import.meta.url,
  ).href;
  const runtimeHookPreload = fileURLToPath(
    new URL(
      "../../../../../packages/ttsc/lib/launcher/internal/runtimeHookPreload.js",
      import.meta.url,
    ),
  );
  const ttscPackageRoot = fs.realpathSync.native(
    fileURLToPath(new URL("../../../../../packages/ttsc", import.meta.url)),
  );

  const traceDir = path.join(root, "trace");
  const runLaunch = (
    envOverrides: NodeJS.ProcessEnv,
    mode: "check" | "evaluate" | "seed-capability" | "seed-all" = "check",
    alternateHome?: string,
    actorDirectory = projectDir,
  ): IActorReport => {
    fs.rmSync(traceDir, { recursive: true, force: true });
    fs.mkdirSync(traceDir, { recursive: true });
    const env = SidecarEnvironment.merge(process.env, {
      NODE_OPTIONS: undefined,
      TTSC_CACHE_TRUSTED_PRELOADS: undefined,
      TTSX_NODE_OPTIONS_RECORD: undefined,
      TTSC_CACHE_DIR: cacheDir,
      TTSC_E2E_TRACE: traceDir,
      ...envOverrides,
    });
    const result = childProcess.spawnSync(
      process.execPath,
      [
        "--import",
        loader,
        actor,
        cacheDir,
        projectDir,
        tsconfig,
        pluginFile,
        mode,
        ...(alternateHome === undefined ? [] : [alternateHome]),
      ],
      {
        cwd: actorDirectory,
        encoding: "utf8",
        env,
        windowsHide: true,
      },
    );
    assert.equal(result.error, undefined, result.stderr);
    assert.equal(result.signal, null, result.stderr);
    assert.equal(
      result.status,
      0,
      `actor exited ${String(result.status)}:\n${result.stdout}\n${result.stderr}`,
    );
    return JSON.parse(result.stdout) as IActorReport;
  };

  // 1. Trusted port-zero-like preload hits across launches for all three caches.
  const portZeroEnv: NodeJS.ProcessEnv = {
    NODE_OPTIONS: `--require=${portZeroFile}`,
    TTSC_CACHE_TRUSTED_PRELOADS: portZeroReal,
  };
  const launch1 = runLaunch(
    portZeroEnv,
    "seed-all",
    path.join(root, "other-home"),
  );
  assert.notEqual(
    launch1.descriptorLocation,
    null,
    "trusted port-zero preload must locate a descriptor cache entry",
  );
  assert.equal(launch1.descriptorCacheHit, false);
  assert.equal(launch1.descriptorEvaluated, true);
  assert.equal(launch1.descriptorObservationsComplete, true);
  assert.equal(launch1.descriptorDifferentGraphRefused, true);
  assert.equal(launch1.descriptorDifferentNodePathRefused, true);
  assert.equal(launch1.descriptorDifferentHomeRefused, true);
  assert.ok(
    launch1.descriptorInputs.includes(portZeroReal),
    "descriptor evaluation must record the trusted preload root",
  );
  assert.deepEqual(launch1.capabilities, {
    bun: false,
    executable: path.resolve(process.execPath),
    registerHooks: true,
  });
  assert.equal(launch1.capabilityProbes, 1);
  assert.deepEqual(launch1.alternateHomeCapabilities, launch1.capabilities);
  assert.equal(launch1.alternateHomeProbes, 1);
  assert.equal(launch1.runtimeProved, true);
  assert.notEqual(launch1.capabilityAuthority, null);
  assert.equal(launch1.capabilityAuthority, launch1.resolutionFile);

  const launch2 = runLaunch(portZeroEnv, "evaluate");
  assert.equal(launch2.descriptorLocation, launch1.descriptorLocation);
  assert.equal(
    launch2.descriptorCacheHit,
    true,
    "second launch with unchanged trusted preload must hit descriptor cache",
  );
  assert.equal(launch2.descriptorEvaluated, false);
  assert.equal(
    launch2.capabilityProbes,
    0,
    "second launch with unchanged trusted preload must hit runtime capability cache",
  );
  assert.equal(launch2.runtimeProved, true);
  assert.equal(launch2.capabilityAuthority, launch1.capabilityAuthority);
  assert.equal(
    launch2.capabilityCacheHit,
    true,
    "second launch with unchanged trusted preload must hit capability resolution cache",
  );
  assert.equal(launch2.capabilityIsCurrent, true);

  // 2. Cache refusal still permits normal input observation during evaluation.
  const unsupportedFlag = runLaunch(
    { NODE_OPTIONS: "--no-warnings" },
    "evaluate",
  );
  assert.equal(unsupportedFlag.descriptorLocation, null);
  assert.equal(unsupportedFlag.descriptorEvaluated, true);
  assert.equal(unsupportedFlag.descriptorObservationsComplete, true);
  assert.equal(unsupportedFlag.capabilityAuthority, null);
  assert.equal(unsupportedFlag.resolutionFile, null);

  // Same preload untrusted (or glob-listed, or paired with untrusted --require): refuses at all three.
  const untrusted1 = runLaunch({
    NODE_OPTIONS: `--require=${portZeroFile}`,
    TTSC_CACHE_TRUSTED_PRELOADS: undefined,
  });
  assert.equal(untrusted1.descriptorLocation, null);
  assert.equal(untrusted1.capabilityProbes, 1);
  assert.equal(untrusted1.runtimeProved, false);
  assert.equal(untrusted1.capabilityAuthority, null);
  assert.equal(untrusted1.resolutionFile, null);
  assert.equal(untrusted1.runtimeAuthorityReason, "node-options");

  const untrusted2 = runLaunch({
    NODE_OPTIONS: `--require=${portZeroFile}`,
    TTSC_CACHE_TRUSTED_PRELOADS: undefined,
  });
  assert.equal(untrusted2.capabilityProbes, 1);

  const globbed = runLaunch({
    NODE_OPTIONS: `--require=${portZeroFile}`,
    TTSC_CACHE_TRUSTED_PRELOADS: path.join(preloadDir, "*.cjs"),
  });
  assert.equal(globbed.descriptorLocation, null);
  assert.equal(globbed.runtimeProved, false);
  assert.equal(globbed.capabilityAuthority, null);

  const mixed = runLaunch({
    NODE_OPTIONS: `--require=${portZeroFile} --require=${extraUntrustedFile}`,
    TTSC_CACHE_TRUSTED_PRELOADS: portZeroReal,
  });
  assert.equal(mixed.descriptorLocation, null);
  assert.equal(mixed.capabilityProbes, 1);
  assert.equal(mixed.runtimeProved, false);
  assert.equal(mixed.capabilityAuthority, null);

  // 3. Trusted preload's own bytes change: all three caches miss.
  fs.writeFileSync(portZeroFile, `${portZeroSourceV1}// revised\n`);
  const edited1 = runLaunch(portZeroEnv, "seed-all");
  assert.notEqual(edited1.descriptorLocation, null);
  assert.equal(
    edited1.descriptorCacheHit,
    false,
    "editing trusted preload bytes must miss descriptor cache",
  );
  assert.equal(edited1.descriptorEvaluated, true);
  assert.equal(
    edited1.capabilityProbes,
    1,
    "editing trusted preload bytes must miss runtime capability cache",
  );
  assert.equal(edited1.runtimeProved, true);
  assert.notEqual(edited1.capabilityAuthority, null);
  assert.notEqual(
    edited1.capabilityAuthority,
    launch1.capabilityAuthority,
    "editing trusted preload bytes must move capability resolution authority",
  );
  assert.equal(edited1.capabilityCacheHit, false);

  const edited2 = runLaunch(portZeroEnv, "evaluate");
  assert.equal(
    edited2.descriptorCacheHit,
    true,
    `edited preload cache miss (previous write attempted=${edited1.descriptorWriteAttempted}): ${edited2.descriptorReadFailure}`,
  );
  assert.equal(edited2.capabilityProbes, 0);
  assert.equal(edited2.capabilityAuthority, edited1.capabilityAuthority);
  assert.equal(edited2.capabilityCacheHit, true);

  // 4. Trusted preload requiring a local file: hits unchanged, misses when the local file changes,
  //    including when the change lands after locate()'s key and before read() verification.
  const localEnv: NodeJS.ProcessEnv = {
    NODE_OPTIONS: `--require=${preloadWithLocalFile}`,
    TTSC_CACHE_TRUSTED_PRELOADS: preloadWithLocalReal,
  };
  const local1 = runLaunch(localEnv, "seed-all");
  assert.notEqual(
    local1.descriptorLocation,
    null,
    "trusted preload requiring a local file must locate a descriptor entry",
  );
  assert.equal(local1.descriptorCacheHit, false);
  assert.equal(local1.descriptorEvaluated, true);
  assert.equal(local1.descriptorObservationsComplete, true);
  assert.ok(
    local1.descriptorInputs.includes(preloadWithLocalReal),
    "descriptor inputs must include the preload root",
  );
  assert.ok(
    local1.descriptorInputs.includes(localHelperReal),
    "descriptor inputs must include transitive local modules required by the preload",
  );
  assert.ok(local1.descriptorInputs.includes(fixtureManifest));
  assert.ok(
    !local1.descriptorInputs.includes(path.resolve(root, "..", "package.json")),
    "the fixture's package scope must end the preload's manifest search",
  );
  assert.equal(local1.capabilityProbes, 1);
  assert.equal(local1.runtimeProved, true);
  assert.notEqual(local1.capabilityAuthority, null);

  const local2 = runLaunch(localEnv, "evaluate");
  assert.equal(local2.descriptorLocation, local1.descriptorLocation);
  assert.equal(
    local2.descriptorCacheHit,
    true,
    `unchanged local preload graph must hit descriptor cache (previous write attempted=${local1.descriptorWriteAttempted}): ${local2.descriptorReadFailure}`,
  );
  assert.equal(
    local2.capabilityProbes,
    0,
    "unchanged local preload graph must hit runtime capability cache",
  );
  assert.equal(local2.capabilityAuthority, local1.capabilityAuthority);
  assert.equal(
    local2.capabilityCacheHit,
    true,
    "unchanged local preload graph must hit capability resolution cache",
  );

  // Capture locate()'s cache file BEFORE mutating local-helper.cjs, then edit
  // local-helper.cjs and verify read() misses on that already-located entry.
  const locatedBeforeEdit = local2.descriptorLocation!;
  assert.notEqual(
    PluginDescriptorEvaluationCache.read(locatedBeforeEdit),
    null,
    "entry must hit before local helper changes",
  );
  fs.writeFileSync(localHelperFile, "module.exports = { version: 2 };\n");
  assert.equal(
    PluginDescriptorEvaluationCache.read(locatedBeforeEdit),
    null,
    "changing a local file required by the preload after locate() must miss in read()",
  );

  const localEdited = runLaunch(localEnv, "seed-all");
  assert.equal(
    localEdited.descriptorCacheHit,
    false,
    "changing local preload dependency must miss descriptor cache",
  );
  assert.equal(
    localEdited.capabilityProbes,
    1,
    "changing local preload dependency must miss runtime capability cache",
  );
  assert.notEqual(
    localEdited.capabilityAuthority,
    local1.capabilityAuthority,
    "changing local preload dependency must move capability resolution authority",
  );
  assert.equal(localEdited.capabilityCacheHit, false);

  // 5. --import of a trusted file refuses at all three sites.
  const importRefused = runLaunch({
    NODE_OPTIONS: `--import=${pathToFileURL(esmPreloadFile).href}`,
    TTSC_CACHE_TRUSTED_PRELOADS: esmPreloadReal,
  });
  assert.equal(
    importRefused.descriptorLocation,
    null,
    "--import must refuse descriptor cache even when trusted",
  );
  assert.equal(importRefused.capabilityProbes, 1);
  assert.equal(
    importRefused.runtimeProved,
    false,
    "--import must refuse capability runtime authority even when trusted",
  );
  assert.equal(importRefused.capabilityAuthority, null);
  assert.equal(importRefused.resolutionFile, null);
  const importRefused2 = runLaunch({
    NODE_OPTIONS: `--import=${pathToFileURL(esmPreloadFile).href}`,
    TTSC_CACHE_TRUSTED_PRELOADS: esmPreloadReal,
  });
  assert.equal(
    importRefused2.capabilityProbes,
    1,
    "--import must refuse runtime capability cache across launches",
  );

  // 6. A ttsx-like child with runtimeHookPreload loaded records only the user preload's graph.
  const ttsxLikeEnv = {
    TTSC_CACHE_TRUSTED_PRELOADS: preloadWithLocalReal,
    ...TtsxNodeOptions.give(
      { NODE_OPTIONS: `--require=${preloadWithLocalFile}` },
      `--require=${preloadWithLocalFile} --require ${JSON.stringify(runtimeHookPreload)}`,
    ),
  };
  const ttsxChild = runLaunch(ttsxLikeEnv, "evaluate");
  assert.notEqual(ttsxChild.descriptorLocation, null);
  assert.equal(ttsxChild.descriptorEvaluated, true);
  assert.equal(ttsxChild.descriptorObservationsComplete, true);
  assert.ok(
    tsxChildDescriptorCheck(
      local1,
      ttscPackageRoot,
      preloadWithLocalReal,
      localHelperReal,
    ),
  );
  assert.ok(
    tsxChildDescriptorCheck(
      ttsxChild,
      ttscPackageRoot,
      preloadWithLocalReal,
      localHelperReal,
    ),
  );
  assert.equal(
    ttsxChild.capabilityProbes,
    0,
    "ttsx-like child with runtimeHookPreload loaded must reuse the plain launch's capability key without including runtimeHookPreload",
  );
  const ttsxChild2 = runLaunch(ttsxLikeEnv, "evaluate");
  assert.equal(
    ttsxChild2.descriptorLocation,
    ttsxChild.descriptorLocation,
    "second ttsx-like child must locate the same descriptor entry",
  );
  assert.equal(
    ttsxChild2.descriptorCacheHit,
    true,
    "second ttsx-like child must hit the cached descriptor entry",
  );
  assert.equal(ttsxChild2.capabilityProbes, 0);

  const preferredHelper = path.join(preloadDir, "local-helper");
  fs.writeFileSync(preferredHelper, "module.exports = { version: 3 };\n");
  const redirected = runLaunch(localEnv, "evaluate");
  assert.equal(
    redirected.descriptorCacheHit,
    false,
    "a new higher-priority preload dependency must invalidate the descriptor cache",
  );
  assert.ok(
    redirected.descriptorInputs.includes(
      fs.realpathSync.native(preferredHelper),
    ),
  );
  assert.ok(!redirected.descriptorInputs.includes(localHelperReal));
  assert.equal(redirected.capabilityProbes, 1);
  assert.equal(redirected.capabilityCacheHit, false);
  assert.equal(runLaunch(localEnv).descriptorCacheHit, true);

  // Direct boundary checks: empty/whitespace NODE_OPTIONS, non-preload flags,
  // missing root in require.cache, relative -r, and NODE_PATH mismatch on bare -r.
  const baseEnv = SidecarEnvironment.merge(process.env, {
    NODE_OPTIONS: undefined,
    TTSC_CACHE_TRUSTED_PRELOADS: undefined,
    TTSC_CACHE_DIR: cacheDir,
  });
  const locateDescriptor = (
    overrides: NodeJS.ProcessEnv,
    cwd = projectDir,
  ): string | null =>
    PluginDescriptorEvaluationCache.locate({
      cacheDir,
      context: {
        binary: "",
        cwd,
        dirname: cwd,
        filename: pluginFile,
        plugin: { transform: pluginFile },
        pluginConfigDir: cwd,
        projectRoot: cwd,
        tsconfig: path.join(cwd, tsconfig),
      },
      cwd,
      env: { ...baseEnv, ...overrides },
      projectRoot: cwd,
      request: pluginFile,
      runtime: process.execPath,
      version: "trusted-preload-unit",
    });

  for (const emptyOptions of [undefined, "", "   \t  "]) {
    assert.notEqual(locateDescriptor({ NODE_OPTIONS: emptyOptions }), null);
    assert.notEqual(
      CapabilityResolutionFormat.resolutionFile({
        cwd: projectDir,
        tsconfig,
        env: { ...baseEnv, NODE_OPTIONS: emptyOptions },
      }),
      null,
    );
  }

  // Unloaded trusted root in current process refuses launcher capability key.
  assert.equal(locateDescriptor(portZeroEnv), null);
  assert.equal(
    CapabilityResolutionFormat.resolutionFile({
      cwd: projectDir,
      tsconfig,
      env: {
        ...baseEnv,
        NODE_OPTIONS: `--require=${portZeroFile}`,
        TTSC_CACHE_TRUSTED_PRELOADS: portZeroReal,
      },
    }),
    null,
    "launcher capability key must refuse when trusted root is absent from require.cache",
  );

  // Relative -r resolved from evaluator cwd works for descriptor locate.
  const relPath = `./${path.relative(projectDir, portZeroFile).split(path.sep).join("/")}`;
  assert.notEqual(
    runLaunch({
      NODE_OPTIONS: `--require=${relPath}`,
      TTSC_CACHE_TRUSTED_PRELOADS: portZeroReal,
    }).descriptorLocation,
    null,
  );

  // Package specifier -r resolves via node_modules from the launch cwd.
  const pkgDir = path.join(projectDir, "node_modules", "trusted-pkg-preload");
  fs.mkdirSync(pkgDir, { recursive: true });
  const pkgEntry = path.join(pkgDir, "index.cjs");
  fs.writeFileSync(
    path.join(pkgDir, "package.json"),
    JSON.stringify({ name: "trusted-pkg-preload", main: "index.cjs" }),
  );
  fs.writeFileSync(pkgEntry, "module.exports = {};\n");
  const pkgEntryReal = fs.realpathSync.native(pkgEntry);
  const packageLaunch = runLaunch({
    NODE_OPTIONS: "-r trusted-pkg-preload",
    TTSC_CACHE_TRUSTED_PRELOADS: pkgEntryReal,
  });
  assert.notEqual(packageLaunch.descriptorLocation, null);
  assert.equal(packageLaunch.descriptorDifferentNodePathRefused, true);

  // A relative NODE_PATH names a different dependency in a different cwd.
  const alternate = path.join(root, "alternate");
  for (const [directory, bun] of [
    [projectDir, true],
    [alternate, false],
  ] as const) {
    const search = path.join(directory, "nodepath");
    fs.mkdirSync(search, { recursive: true });
    fs.writeFileSync(
      path.join(search, "runtime-capability-marker.js"),
      bun ? "globalThis.Bun = {};" : "module.exports = {};",
    );
  }
  const barePreload = path.join(preloadDir, "with-node-path.cjs");
  fs.writeFileSync(barePreload, 'require("runtime-capability-marker");');
  const relativeSearch = runLaunch({
    NODE_OPTIONS: `--require=${barePreload}`,
    TTSC_CACHE_TRUSTED_PRELOADS: barePreload,
    NODE_PATH: "nodepath",
    TTSC_TEST_PRELOAD_ALTERNATE_CWD: alternate,
  });
  assert.equal(relativeSearch.descriptorLocation, null);
  assert.equal(relativeSearch.capabilities.bun, true);
  assert.equal(relativeSearch.alternateCapabilities?.bun, false);

  // Both Node processes have the same initialized global search paths. The
  // absolute preload itself chooses a different child from the working dir.
  const cwdPreload = path.join(preloadDir, "with-cwd.cjs");
  fs.writeFileSync(
    cwdPreload,
    'require(require("node:path").join(process.cwd(), "cwd-helper.cjs"));\n',
  );
  fs.writeFileSync(
    path.join(projectDir, "cwd-helper.cjs"),
    "module.exports = 1;",
  );
  fs.writeFileSync(
    path.join(alternate, "cwd-helper.cjs"),
    "module.exports = 2;",
  );
  const differentChildGraph = runLaunch(
    {
      NODE_OPTIONS: `--require=${cwdPreload}`,
      TTSC_CACHE_TRUSTED_PRELOADS: fs.realpathSync.native(cwdPreload),
      NODE_PATH: undefined,
    },
    "check",
    undefined,
    alternate,
  );
  assert.notEqual(differentChildGraph.resolutionFile, null);
  assert.equal(differentChildGraph.capabilityProbes, 1);
  assert.equal(differentChildGraph.capabilities.registerHooks, true);
  assert.equal(differentChildGraph.runtimeProved, false);
  assert.equal(differentChildGraph.capabilityAuthority, null);

  // Non-preload flags and nonexistent paths refuse.
  for (const nodeOptions of [
    "--loader ./loader.mjs",
    `--require=${portZeroFile} --no-warnings`,
    `--require=${path.join(preloadDir, "does-not-exist.cjs")}`,
  ]) {
    assert.equal(
      locateDescriptor({
        NODE_OPTIONS: nodeOptions,
        TTSC_CACHE_TRUSTED_PRELOADS: [
          portZeroReal,
          path.join(preloadDir, "does-not-exist.cjs"),
        ].join(path.delimiter),
      }),
      null,
    );
  }
}

function tsxChildDescriptorCheck(
  report: IActorReport,
  ttscPackageRoot: string,
  preloadRoot: string,
  localHelper: string,
): boolean {
  assert.ok(
    report.descriptorInputs.includes(preloadRoot),
    "ttsx-like child must record the user preload root",
  );
  assert.ok(
    report.descriptorInputs.includes(localHelper),
    "ttsx-like child must record the user preload's local helper",
  );
  assert.equal(
    report.descriptorInputs.some((input) =>
      path.resolve(input).startsWith(`${ttscPackageRoot}${path.sep}`),
    ),
    false,
    `ttsx-like child must not include ttsc or runtimeHookPreload modules in descriptor inputs: ${JSON.stringify(report.descriptorInputs)}`,
  );
  return true;
}
