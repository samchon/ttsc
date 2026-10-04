import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { TestProject } from "../../../../utils/src/TestProject";
import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { createTransformCacheKey } from "../../../../../packages/unplugin/src/core/transform/cache/createTransformCacheKey";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { disposeCachedTransform } from "../../../../../packages/unplugin/src/core/transform/cache/disposeCachedTransform";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { refreshFilesystemClockReference } from "../../../../../packages/unplugin/src/core/transform/clock/refreshFilesystemClockReference";
import { disposeFilesystemClockReference } from "../../../../../packages/unplugin/src/core/transform/clock/disposeFilesystemClockReference";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { createHostPathIdentityContext } from "../../../../../packages/unplugin/src/core/transform/filesystem/createHostPathIdentityContext";
import { selectExternalInputPaths } from "../../../../../packages/unplugin/src/core/transform/envelope/selectExternalInputPaths";
import { releaseCaptureResources } from "../../../../../packages/unplugin/src/core/transform/generation/releaseCaptureResources";
import { transferCaptureClockReference } from "../../../../../packages/unplugin/src/core/transform/generation/transferCaptureClockReference";
import { removeCaptureScratch } from "../../../../../packages/unplugin/src/core/transform/generation/removeCaptureScratch";
import { generationNotificationsAvailable, retainGenerationNotifications } from "../../../../../packages/unplugin/src/core/transform/generation/retainGenerationNotifications";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createProjectMutationTracker";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import { transformTtsc } from "../../../../../packages/unplugin/src/core/transform/transformTtsc";
import { captureExternalInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/captureExternalInputSnapshot";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies persistent validation reuses only currently qualified input witnesses.
 *
 * Native corpus observations are consumer inputs, not a compiler acquisition
 * receipt. Successful local cleanup transfers a real clock directory through
 * the production ownership operation; the coordinator then mints its own probe.
 * Supplied watch handles never acquire native content-silence authority.
 *
 * 1. Observe one corpus with twelve modules, 24 externals, 24 globals, a native
 *    global alias, 100 descriptors and 250 unadmitted asset directories.
 * 2. Contrast output-directory recreation, explicit file appearance and a directory config candidate before delivering shared and partitioned graphs through actual ready cache owners;
 *    measure content reuse and metadata work, then touch identical bytes.
 * 3. Contrast complete fallback, per-file unreachable inputs and empty explicit
 *    completeness with relevant edits requiring capture and owner eviction.
 * 4. Close unretained project/host registrations over the same physical root,
 *    then dispose owners and verify transferred native probe storage is removed.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual transformTtsc uses real project/external/universal captures, supported tracker constructors, notification retention, releaseCaptureResources and transferCaptureClockReference. Shared steady deliveries read no content and reprove a touched single-spelling global at most once. Two spellings of an aliased target may independently reprove it, then both reuse their witnesses. Complete fallback re-proves touched project/external content then reuses that proof. Partitioned deliveries bound content reads and metadata, ignore unreachable externals, and reject reachable edits; empty completeness excludes graph-only external changes. Actual action selection evicts changed owners without starting a compiler. A 250-directory asset population stays outside the actual project walk; project and host constructors register two recursive owners on the same native root, and unretained release closes each once. Three implicit outDir recreations retain a consumer owner; after explicit file-named exclude replaces those defaults, native legacy-file appearance is hashed and evicts its distinct owner. Actual external/universal captures retain the directory marker and target, three transformTtsc deliveries reuse that owner, and replacing the directory by a file selects capture.
 * @evidence contracts/testing.md#independent-expectations Authored module partitions, 24 named global/external sets and 100 descriptor categories define the universe. Node SHA-256 and native stat/realpath independently record fixture facts. Native fixture modification times precede the actual minted probe, without altered metadata responses. Per-cache native read/stat/lstat ledgers supply operation counts; literal zero/one/two/12/100 bounds and serve/capture expectations follow from unchanged bytes, distinct lexical witnesses, explicit completeness and reachability. No expected classification is computed by a production selector. The literal src-only policy admits exactly root/src and twelve source hashes despite 250 asset directories. Independent native realpath establishes the two registrations share a physical root, not a backend handle. Literal output .ts paths prevent an extension-only negative, the legacy source supplies an independent SHA, and the directory fingerprint is Node SHA-256 of the contract marker ttsc:host-input:directory plus NUL. Authored host hashes model consumer inputs and do not certify Go callback acquisition or host-input assembly. The custom backend lacks content-silence authority, so 50 absent descriptor names require native probes; this row does not claim the old native-authoritative stat bound of 12.
 * @evidence contracts/testing.md#distinguishing-cases Eight-module full shared closure and twelve-module partition contrast with failed-registration complete fallback and empty explicit completeness. Same-byte touches preserve the owner but refresh content witnesses; changed reachable bytes evict while unreachable/complete-excluded externals retain it. Native alias spelling has its own reusable metadata witness. Missing descriptor inputs stay unavailable-file facts, not inferred from unchanged directory listings. The local population row contrasts admitted source paths with excluded assets and a separately tracked host-input tree, then requires zero retained handles after cleanup. Output-directory delete/recreate contrasts with configuration withdrawal and a file-named exclusion that conservatively remains in the walk. Unchanged directory-kind host input contrasts with directory-to-regular-file replacement. Each changed owner is tested through action selection; no compiler starts after eviction.
 * @evidence contracts/testing.md#execution-ownership One source unit calls owning operations in process over one native corpus, one native directory alias and separately owned per-mode clock/scratch storage. Scripted watch handles expose only supported registration/close callbacks; private authority maps/flags are not planted. Actual cleanup and ownership publication connect ready consumer input to coordinator clock refresh and disposal, not native compiler/capture acquisition, descriptor reload output, watcher-kernel delivery, original250-directory backend cardinality or IPC. The population row observes constructor root registrations through the supported watch capability, which receives no admission predicate. It therefore does not certify recursive descendant subscription count or the original capture acquisition/finally assembly. No compiler, peer, process or host runs, and full transformTtsc is never called after eviction.
 */
export async function test_persistent_validation_reuses_only_qualified_input_witnesses(): Promise<void> {
  const source = "export const value = 1;\n";
  const output = "export const compiled = 2;\n";
  const files: Record<string, string> = { "tsconfig.json": '{"include":["src"]}', "package.json": '{"name":"validation-corpus"}' };
  const moduleNames = Array.from({ length: 12 }, (_, index) => "src/mod" + index + ".ts");
  const externalNames = Array.from({ length: 24 }, (_, index) => "node_modules/dep" + index + "/index.d.ts");
  const globalNames = Array.from({ length: 24 }, (_, index) => "node_modules/global" + index + "/index.d.ts");
  const descriptorNames = Array.from({ length: 100 }, (_, index) => "node_modules/descriptor/input-" + index + ".json");
  for (const name of moduleNames) files[name] = source;
  for (const [index, name] of [...externalNames, ...globalNames].entries()) files[name] = "export declare const input" + index + ": number;\n";
  for (const [index, name] of descriptorNames.entries()) if (index % 2 === 0) files[name] = "{}\n";
  for (let index = 0; index < 250; index++) files["assets/unused-" + index + "/data.json"] = "{}\n";
  files["plugin-source/input.json"] = "{}\n";
  const root = fs.realpathSync.native(TestProject.createProject(files));
  const alias = path.join(root, "global-alias");
  fs.symlinkSync(path.join(root, "node_modules", "global0"), alias, process.platform === "win32" ? "junction" : "dir");
  assert.equal(fs.realpathSync.native(path.join(alias, "index.d.ts")), fs.realpathSync.native(path.join(root, globalNames[0]!)));
  for (const name of Object.keys(files)) fs.utimesSync(path.join(root, name), new Date(0), new Date(0));
  const config = path.join(root, "tsconfig.json");
  const options = resolveOptions({ project: config });
  const key = createTransformCacheKey({ tsconfig: config, aliasPaths: {}, compilerOptions: options.compilerOptions, plugins: options.plugins });
  const registrations: { directory: string; recursive: boolean; closed: number }[] = [];
  const localCache = createTtscTransformCache({
    caseSensitive: () => true,
    watch: (directory, _listener, _onError, recursive) => {
      const registration = { directory, recursive: recursive === true, closed: 0 };
      registrations.push(registration);
      return { close: () => { registration.closed++; } };
    },
  });
  const localFilesystem = transformFilesystem(localCache);
  const localScratch = TestProject.tmpdir("ttsc-unretained-population-");
  let localProject: TtscProjectMutationTracker | undefined;
  let localHost: TtscProjectMutationTracker | undefined;
  let locallyReleased = false;
  try {
    assert.equal(fs.readdirSync(path.join(root, "assets")).length, 250);
    const policy = { ...readProjectMembershipPolicy(config), useCaseSensitiveFileNames: true };
    const snapshot = collectProjectInputSnapshot(root, createHostPathIdentityContext(localFilesystem), localFilesystem, undefined, { policy });
    assert.equal(snapshot.complete, true);
    assert.equal(snapshot.directoryComplete, true);
    assert.deepEqual(snapshot.walkFailures, []);
    assert.deepEqual(snapshot.projectDirectories.map((directory) => directory.path).sort(), [root, path.join(root, "src")].sort());
    assert.ok(snapshot.projectDirectories.every((directory) => directory.relevant));
    assert.deepEqual(Object.keys(snapshot.hashes).sort(), moduleNames.slice().sort());
    const expectedDigest = createHash("sha256").update(source).digest("hex");
    for (const name of moduleNames) assert.equal(snapshot.hashes[name], expectedDigest);
    localProject = await createProjectMutationTracker(snapshot.projectDirectories, new Set(moduleNames.map((name) => path.join(root, name))), localFilesystem, policy);
    const pluginDirectory = path.join(root, "plugin-source");
    localHost = await createHostInputMutationTracker([config, pluginDirectory], localFilesystem, new Set([config, pluginDirectory]), "all", root, new Map<string, "tree">([[pluginDirectory, "tree"]]));
    assert.equal(localProject.failed, false);
    assert.equal(localHost.failed, false);
    assert.equal(localProject.contentAuthoritative, false);
    assert.equal(localHost.contentAuthoritative, false);
    assert.deepEqual(registrations.map(({ directory, recursive }) => ({ directory, recursive })), [
      { directory: root, recursive: true },
      { directory: root, recursive: true },
    ]);
    for (const registration of registrations) assert.equal(fs.realpathSync.native(registration.directory), root);
    assert.deepEqual(registrations.map((registration) => registration.closed), [0, 0]);
    await releaseCaptureResources({ project: localProject, host: localHost, retainProject: false, retainHost: false, retainCandidate: false, scratchDirectory: localScratch, retainClockReference: false, captureFailed: false });
    locallyReleased = true;
    assert.deepEqual(registrations.map((registration) => registration.closed), [1, 1]);
    assert.equal(localProject.failed, true);
    assert.equal(localHost.failed, true);
    assert.equal(fs.existsSync(localScratch), false);
  } finally {
    if (!locallyReleased) {
      localProject?.close();
      localHost?.close();
    }
    resetTtscTransformCache(localCache);
    await removeCaptureScratch(localScratch);
  }
  const membershipCache = createTtscTransformCache();
  const membershipFile = path.join(root, moduleNames[0]!);
  const artifacts = path.join(root, "src", "artifacts");
  const legacy = path.join(root, "src", "legacy.ts");
  const configBytes = fs.readFileSync(config);
  try {
    fs.writeFileSync(config, JSON.stringify({ include: ["src"], compilerOptions: { outDir: "src/artifacts" } }));
    fs.mkdirSync(artifacts, { recursive: true });
    fs.writeFileSync(path.join(artifacts, "bundle.0.ts"), "export const generated = 0;\n");
    const result: ITtscCompilerTransformation.ISuccess = {
      type: "success", typescript: Object.fromEntries(moduleNames.map((name) => [name, output])),
      hostInputs: [config], hostInputHashes: { [config]: createHash("sha256").update(fs.readFileSync(config)).digest("hex") },
      hostInputRealpaths: { [config]: fs.realpathSync.native(config) },
    };
    const cached = observeValidationUnitGeneration(root, result);
    const owner = Promise.resolve(cached);
    membershipCache.set("output-membership", owner);
    const action = () => selectCachedGenerationAction({ cache: membershipCache, cached, epoch: undefined,
      file: membershipFile, generation: owner, key: "output-membership", source });
    assert.deepEqual(Object.keys(cached.inputHashes).sort(), moduleNames.slice().sort());
    assert.equal(action(), "serve");
    for (let wave = 1; wave <= 3; wave++) {
      fs.rmSync(artifacts, { recursive: true, force: true });
      fs.mkdirSync(artifacts);
      fs.writeFileSync(path.join(artifacts, "bundle." + wave + ".ts"), "export const generated = " + wave + ";\n");
      const observed = collectProjectInputSnapshot(root, createHostPathIdentityContext(transformFilesystem(membershipCache)), transformFilesystem(membershipCache), undefined, { policy: cached.membershipPolicy });
      assert.equal(observed.complete, true);
      assert.deepEqual(Object.keys(observed.hashes).sort(), moduleNames.slice().sort());
      assert.equal(action(), "serve", "implicit output exclusion survives each native recreation");
      assert.equal(membershipCache.get("output-membership"), owner);
    }
    fs.writeFileSync(config, JSON.stringify({ include: ["src"], compilerOptions: { outDir: "src/artifacts" }, exclude: ["src/legacy.ts"] }));
    assert.equal(action(), "capture", "the configuration change first withdraws the old owner");
    assert.equal(membershipCache.has("output-membership"), false);
    const explicit = observeValidationUnitGeneration(root, { ...result,
      hostInputHashes: { [config]: createHash("sha256").update(fs.readFileSync(config)).digest("hex") } });
    const explicitOwner = Promise.resolve(explicit);
    membershipCache.set("explicit-file-membership", explicitOwner);
    assert.equal(explicit.membershipPolicy.directoryExclusionOrigins?.useImplicitOutputExclusions, false);
    assert.deepEqual(Object.keys(explicit.inputHashes).sort(), [...moduleNames, "src/artifacts/bundle.3.ts"].sort());
    const explicitAction = () => selectCachedGenerationAction({ cache: membershipCache, cached: explicit, epoch: undefined,
      file: membershipFile, generation: explicitOwner, key: "explicit-file-membership", source });
    assert.equal(explicitAction(), "serve");
    const legacySource = "export const legacy: number = 1;\n";
    fs.writeFileSync(legacy, legacySource);
    const observed = collectProjectInputSnapshot(root, createHostPathIdentityContext(transformFilesystem(membershipCache)), transformFilesystem(membershipCache), undefined, { policy: explicit.membershipPolicy });
    assert.equal(observed.complete, true);
    assert.deepEqual(Object.keys(observed.hashes).sort(), [...moduleNames, "src/artifacts/bundle.3.ts", "src/legacy.ts"].sort());
    assert.equal(observed.hashes["src/legacy.ts"], createHash("sha256").update(legacySource).digest("hex"));
    assert.equal(explicitAction(), "capture", "a file-named exclude does not hide actual walk membership");
    assert.equal(membershipCache.has("explicit-file-membership"), false);
  } finally {
    resetTtscTransformCache(membershipCache);
    fs.writeFileSync(config, configBytes);
    fs.rmSync(artifacts, { recursive: true, force: true });
    fs.rmSync(legacy, { force: true });
  }
  const directoryCandidate = path.join(root, "node_modules", "nearer-config.json");
  fs.mkdirSync(directoryCandidate);
  const directoryDigest = createHash("sha256").update("ttsc:host-input:directory\0").digest("hex");
  const directoryResult: ITtscCompilerTransformation.ISuccess = {
    type: "success", typescript: Object.fromEntries(moduleNames.map((name) => [name, output])),
    hostInputs: [directoryCandidate], hostInputHashes: { [directoryCandidate]: directoryDigest },
    hostInputRealpaths: { [directoryCandidate]: fs.realpathSync.native(directoryCandidate) },
  };
  const directoryCache = createTtscTransformCache({ caseSensitive: () => true });
  const directoryFilesystem = transformFilesystem(directoryCache);
  TRANSFORM_RESULT_FILESYSTEM.set(directoryResult, directoryFilesystem);
  const directoryCached: TtscCachedProjectTransform = { result: directoryResult, projectRoot: root, tsconfig: config,
    membershipPolicy: { ...readProjectMembershipPolicy(config), useCaseSensitiveFileNames: true }, inputHashes: {} };
  try {
    assert.equal(fs.statSync(directoryCandidate).isDirectory(), true);
    const project = collectProjectInputSnapshot(root, envelopeDerivation(directoryCached).identityContext, directoryFilesystem, undefined, { policy: directoryCached.membershipPolicy });
    assert.equal(project.complete, true);
    directoryCached.inputHashes = project.hashes;
    directoryCached.projectDirectories = project.projectDirectories;
    directoryCached.projectSnapshotComplete = true;
    const selected = selectExternalInputPaths({ projectRoot: root, result: directoryResult, membershipPolicy: directoryCached.membershipPolicy, filesystem: directoryFilesystem });
    assert.deepEqual(selected, [directoryCandidate]);
    const external = captureExternalInputSnapshot(directoryCached, selected, undefined);
    assert.equal(external.complete, true);
    assert.deepEqual(Object.values(external.hashes), [directoryDigest]);
    directoryCached.externalInputPaths = selected;
    directoryCached.externalInputHashes = external.hashes;
    directoryCached.externalInputRealpaths = external.realpaths;
    directoryCached.externalInputObservations = external.observations;
    directoryCached.externalInputSignatures = external.signatures;
    const universal = captureUniversalHostInputValidation(directoryCached, membershipFile);
    assert.ok(universal.validation);
    assert.equal(universal.validation.entries.get(directoryCandidate)?.readable, true);
    assert.equal(universal.validation.entries.get(directoryCandidate)?.realpath, fs.realpathSync.native(directoryCandidate));
    directoryCached.hostInputValidation = universal.validation;
    const owner = Promise.resolve(directoryCached);
    directoryCache.set(key, owner);
    for (let wave = 0; wave < 3; wave++) {
      assert.equal((await transformTtsc(membershipFile, source, options, undefined, directoryCache))?.code, output);
      assert.equal(directoryCache.get(key), owner, "unchanged directory observation keeps the exact consumer owner");
    }
    fs.rmdirSync(directoryCandidate);
    fs.writeFileSync(directoryCandidate, '{"nearer":true}\n');
    assert.equal(fs.statSync(directoryCandidate).isFile(), true);
    assert.equal(selectCachedGenerationAction({ cache: directoryCache, cached: directoryCached, epoch: undefined,
      file: membershipFile, generation: owner, key, source }), "capture");
    assert.equal(directoryCache.has(key), false, "directory-to-file replacement withdraws the ready owner");
  } finally {
    disposeCachedTransform(directoryCached);
    resetTtscTransformCache(directoryCache);
    TRANSFORM_RESULT_FILESYSTEM.delete(directoryResult);
    fs.rmSync(directoryCandidate, { recursive: true, force: true });
  }
  for (const mode of ["shared", "partitioned", "complete-fallback", "complete-empty"] as const) {
    for (const name of Object.keys(files)) fs.utimesSync(path.join(root, name), new Date(0), new Date(0));
    const names = mode === "shared" ? moduleNames.slice(0, 8) : moduleNames;
    const modules = names.map((name) => path.join(root, name));
    let reads = 0;
    let stats = 0;
    let metadata: string[] = [];
    const cache = createTtscTransformCache({
      caseSensitive: () => true,
      readFile: (file) => { reads++; return fs.readFileSync(file); },
      stat: (file) => { stats++; return fs.statSync(file); },
      lstat: (file) => { if (file.startsWith(root + path.sep)) metadata.push(file); return fs.lstatSync(file, { bigint: true }); },
      watch: () => {
        if (mode === "complete-fallback") throw Object.assign(new Error("authored ENOSPC registration"), { code: "ENOSPC" });
        return { close: () => undefined };
      },
    });
    const filesystem = transformFilesystem(cache);
    const globals = mode === "shared" ? [...globalNames, "global-alias/index.d.ts"] : [];
    const reached = mode === "partitioned" ? externalNames.slice(0, 12) : externalNames;
    const provenNames = [...names, ...reached, ...globals];
    const descriptors = descriptorNames.map((name) => path.join(root, name));
    const hostInputs = [config, ...descriptors];
    const digest = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    const result: ITtscCompilerTransformation.ISuccess = {
      type: "success", typescript: Object.fromEntries(names.map((name) => [name, output])),
      graph: {
        edges: Object.fromEntries(names.map((name, index) => [name, mode === "partitioned" ? [externalNames[index]!] : externalNames])),
        globals, configs: [],
        inputHashes: Object.fromEntries(provenNames.map((name) => [name, digest(path.join(root, name))])),
        inputRealpaths: Object.fromEntries(provenNames.map((name) => [name, fs.realpathSync.native(path.join(root, name))])),
      },
      hostInputs,
      hostInputHashes: Object.fromEntries(hostInputs.map((file) => [file, fs.existsSync(file) ? digest(file) : null])),
      hostInputRealpaths: Object.fromEntries(hostInputs.map((file) => [file, fs.existsSync(file) ? fs.realpathSync.native(file) : null])),
      ...(mode === "complete-empty" ? { dependenciesComplete: names } : {}),
    };
    const clock = TestProject.tmpdir("ttsc-validation-clock-");
    const scratch = TestProject.tmpdir("ttsc-validation-cleanup-");
    TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
    const cached: TtscCachedProjectTransform = { result, projectRoot: root, tsconfig: config,
      membershipPolicy: { ...readProjectMembershipPolicy(config), useCaseSensitiveFileNames: true }, inputHashes: {} };
    const restore = new Map<string, Buffer>();
    const trackers: TtscProjectMutationTracker[] = [];
    let published = false;
    try {
      refreshFilesystemClockReference(clock, filesystem);
      const probe = fs.statSync(path.join(clock, "clock-reference"), { bigint: true });
      const nativeInput = fs.statSync(modules[0]!, { bigint: true });
      assert.equal(probe.dev, nativeInput.dev);
      assert.ok(probe.mtimeNs > nativeInput.mtimeNs);
      const state = envelopeDerivation(cached);
      const project = collectProjectInputSnapshot(root, state.identityContext, filesystem, undefined, { policy: cached.membershipPolicy });
      assert.equal(project.complete, true);
      cached.inputHashes = project.hashes;
      cached.projectDirectories = project.projectDirectories;
      cached.projectSnapshotComplete = true;
      const externalPaths = selectExternalInputPaths({ projectRoot: root, result, membershipPolicy: cached.membershipPolicy, filesystem });
      const external = captureExternalInputSnapshot(cached, externalPaths, undefined);
      assert.equal(external.complete, true);
      cached.externalInputPaths = externalPaths;
      cached.externalInputHashes = external.hashes;
      cached.externalInputRealpaths = external.realpaths;
      cached.externalInputObservations = external.observations;
      cached.externalInputSignatures = external.signatures;
      const universal = captureUniversalHostInputValidation(cached, modules[0]!);
      assert.ok(universal.validation);
      cached.hostInputValidation = universal.validation;
      const projectTracker = await createProjectMutationTracker(project.projectDirectories, new Set(modules), filesystem, cached.membershipPolicy);
      trackers.push(projectTracker);
      const hostTracker = await createHostInputMutationTracker(hostInputs, filesystem, universal.validation.covered, "all", root);
      trackers.push(hostTracker);
      const retained = retainGenerationNotifications({ cached, project: projectTracker, host: hostTracker, candidate: undefined,
        retainProjectMembership: true, retainNotifications: true, stableProjectSnapshot: true,
        notificationsAvailable: generationNotificationsAvailable(projectTracker, hostTracker, undefined) });
      await releaseCaptureResources({ project: projectTracker, host: hostTracker,
        retainProject: retained.project, retainHost: retained.host, retainCandidate: false,
        scratchDirectory: scratch, clockReferenceDirectory: clock, retainClockReference: true, captureFailed: false });
      assert.equal(fs.existsSync(scratch), false);
      transferCaptureClockReference(cached, clock);
      published = true;
      const owner = Promise.resolve(cached);
      cache.set(key, owner);
      const deliver = (file: string) => transformTtsc(file, source, options, undefined, cache);
      const resetCounts = () => { reads = 0; stats = 0; metadata = []; };
      for (const file of modules) assert.equal((await deliver(file))?.code, output);
      resetCounts();
      for (const file of modules) {
        metadata = [];
        assert.equal((await deliver(file))?.code, output);
        assert.equal(cache.get(key), owner);
        if (mode === "partitioned") assert.ok(metadata.length <= 100, "qualified per-file metadata stays within the descriptor population");
      }
      const steady = reads;
      if (mode !== "complete-fallback") assert.equal(steady, 0, "qualified signatures reuse content across sibling deliveries");
      if (mode === "partitioned") {
        assert.ok(reads / modules.length <= 12);
        assert.ok(stats >= 50 * modules.length, "unproved native absence requires each exact candidate probe");
        const unreachable = path.join(root, externalNames[23]!);
        restore.set(unreachable, fs.readFileSync(unreachable));
        fs.appendFileSync(unreachable, "// irrelevant to partition zero\n");
        assert.equal((await deliver(modules[0]!))?.code, output);
        assert.equal(cache.get(key), owner);
      } else if (mode !== "complete-empty") {
        const touched = mode === "shared" ? path.join(root, globalNames[1]!) : path.join(root, externalNames[0]!);
        const beforeBytes = fs.readFileSync(touched);
        fs.utimesSync(touched, new Date(1000), new Date(1000));
        if (mode === "complete-fallback") fs.utimesSync(modules[4]!, new Date(1000), new Date(1000));
        resetCounts();
        assert.equal((await deliver(modules[0]!))?.code, output);
        assert.equal(cache.get(key), owner);
        assert.deepEqual(fs.readFileSync(touched), beforeBytes);
        if (mode === "shared") assert.equal(reads, 1, "a shared touched single-spelling input is content-proven once");
        else assert.ok(reads > steady / modules.length, "changed metadata requires renewed content comparison");
        resetCounts();
        assert.equal((await deliver(modules[1]!))?.code, output);
        assert.ok(reads <= steady / modules.length, "a renewed witness is shared by the next sibling");
        if (mode === "shared") {
          fs.utimesSync(path.join(root, globalNames[0]!), new Date(1000), new Date(1000));
          resetCounts();
          assert.equal((await deliver(modules[0]!))?.code, output);
          assert.ok(reads <= 2, "two exact spellings can independently reprove one physical target");
          resetCounts();
          assert.equal((await deliver(modules[1]!))?.code, output);
          assert.equal(reads, 0, "both alias spelling witnesses are reusable by the next sibling");
        }
      }
      const changed = path.join(root, mode === "shared" ? globalNames[2]! : externalNames[0]!);
      restore.set(changed, fs.readFileSync(changed));
      fs.appendFileSync(changed, "// actual changed input\n");
      if (mode === "complete-empty") {
        assert.equal((await deliver(modules[0]!))?.code, output);
        assert.equal(cache.get(key), owner, "explicit empty completeness excludes graph-only dependencies");
      } else {
        assert.equal(selectCachedGenerationAction({ cache, cached, epoch: undefined, file: modules[0]!,
          generation: owner, key, source }), "capture");
        assert.equal(cache.has(key), false);
      }
    } finally {
      disposeCachedTransform(cached);
      resetTtscTransformCache(cache);
      for (const tracker of trackers) tracker.close();
      for (const [file, bytes] of restore) fs.writeFileSync(file, bytes);
      TRANSFORM_RESULT_FILESYSTEM.delete(result);
      if (published) assert.equal(fs.existsSync(clock), false, "disposal owns transferred probe storage");
      disposeFilesystemClockReference(clock);
      await removeCaptureScratch(scratch);
    }
  }
}
