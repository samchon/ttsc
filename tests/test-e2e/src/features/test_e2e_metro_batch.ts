import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createLoaderPoolWorker, type LoaderPoolOutcome } from "../batch/LoaderPoolWorker";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import { waitFor } from "../internal/unplugin/internal/adapter-vite-serve/waitFor";
import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

/**
 * Delivers distinct modules through one shared native loader pool.
 *
 * @evidence contracts/testing.md#behavioral-verification Metro forwards transformed source and original arguments; Turbopack completes once with executable source, mapless preparse text and dependency records. Initial native admission requires one actual ApplyProgram receipt across the two workers while that hook writes an independently authored non-input log, whose bytes must appear without joining the declared record. The nested relative banner configFile must produce its own text and exclude the discovered root decoy; later edits to that exact nested file must replace the native publication.
 * @evidence contracts/testing.md#independent-expectations Independently authored preparse text, absent map, marker, caller arguments and native ApplyProgram log distinguish delivery and shared compilation independently of adapter counters. The actual resident Program's case-policy receipt supplies an independent reference for two Node cache-root proxy queries; both roots are assumed to have the selected fixture's comparison policy, without certifying arbitrary volumes or executables.
 * @evidence contracts/testing.md#distinguishing-cases Two resident processes request different modules through different built adapters, then observe failure/replay/repair under the same options/session; real publication identities distinguish reuse from another compile. The original native compile-count assertion is limited to initial pool admission, before the explicit declaration/candidate/membership transitions. Ignored hashed output creation contrasts with three delete/recreate transitions of an owned directory below the configured outDir, followed by retained publication and unchanged ApplyProgram receipt.
 * @evidence contracts/testing.md#execution-ownership One pool starts two resident workers, the existing Turbopack owner in development mode with its real default bridge, each observing normal/failure/replay/repair and changed-external/replay states with simultaneous unrelated candidate-directory and ignored hashed-output churn. The existing external-config epoch also changes both delivered source files while its two requests carry their original stale bytes; actual native source and executable value must follow disk. Later deliveries retain that publication despite divergent host text, and joined real stderr must contain one divergent-source warning per resident. The first Metro response additionally forwards one excluded source unchanged; later commands do not repeat that control. This is seventeen planned adapter transforms within sixteen worker commands. No request creates another worker, host, project or configuration profile; initial native producer receipt and later publication identities are asserted separately.
 * @evidence contracts/e2e.md#necessary-boundary Built loaders, inherited session and real producer cross process boundaries. This is not a running Next or Metro server.
 * @evidence contracts/e2e.md#shared-execution The pool borrows one prepared population. Metro explicitly selects its root project; Turbopack discovers the nested files-empty solution and selects that same root through its reference. Both requests must still share one initial native admission. No worker creates a project or a per-case producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Environment copies and a fresh session isolate the pool. Both case-root proxies are queried before native admission so their cache directory creation cannot introduce an extra input epoch; the exact apparent-platform descriptor is restored synchronously. Source/config bytes and both authored churn files are restored before close; the initially absent output recreation subtree is owned exclusively and removed. The capture-time producer configuration and its initially absent log are restored only after both workers join. Actual close is joined; missed deadlines reject as unresolved ownership and retain inputs.
 * @evidence contracts/e2e.md#preserved-coverage Metro forwarding and Turbopack source/absent-map/dependency delivery retain the two-worker single-compile distinction. Adds actual shared failed publication/replay/repair and relative nested configFile selection over a discovered-root decoy while preserving initial arguments/absent-map/dependency delivery; The existing Turbopack watching worker additionally owns real declaration signal/repeat/acknowledgment, ignored package bytes, preferred candidate appearance, source membership and persistent record after joined close. Additional native recompilation and predicate revalidation are state costs of this same pool, not claimed as one total Program. Arbitrary restart, dead-owner takeover and a live external bundler watcher remain unproved.
 */
export async function test_e2e_metro_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const lib = path.join(TestProject.WORKSPACE_ROOT, "packages/metro/lib");
  const baseline = fs.existsSync(workspace.programRunLog) ? fs.statSync(workspace.programRunLog).size : 0;
  const receiptOffset = BatchWorkspace.readContextReceipts(workspace).length;
  const caseOffset = fs.existsSync(workspace.casePolicyReceipt) ? fs.readFileSync(workspace.casePolicyReceipt, "utf8").split(/\r?\n/).filter(Boolean).length : 0;
  const session = path.join(workspace.root, "loader-pool-session");
  const recreatedOutputDirectory = path.join(workspace.root, "dist/batch-recreated-output");
  assert.equal(fs.existsSync(recreatedOutputDirectory), false, "the pool owns its output recreation subtree exclusively");
  const contractPath = path.join(workspace.root, "src/contract.ts");
  const originalContract = fs.readFileSync(contractPath);
  const bannerPath = path.join(workspace.root, "config", "banner.config.json");
  const originalBanner = fs.readFileSync(bannerPath);
  const deliveredPaths = [path.join(workspace.root, "src/bundle.ts"), path.join(workspace.root, "src/pool-routing/map.ts")];
  const originalDelivered = deliveredPaths.map((file) => fs.readFileSync(file, "utf8"));
  const configPath = path.join(workspace.root, "tsconfig.json");
  const originalConfig = fs.readFileSync(configPath);
  const nonInputRaceFile = path.join(workspace.root, "batch-native-non-input.log");
  const nonInputRaceContent = "written by actual ApplyProgram while capture is active\n";
  assert.equal(fs.existsSync(nonInputRaceFile), false);
  const poolConfig = JSON.parse(originalConfig.toString("utf8"));
  const nativeProbe = poolConfig.compilerOptions.plugins.find((entry: { name?: string }) => entry.name === "shared-real-program-probe");
  assert.ok(nativeProbe, "the existing native producer must own the capture-time write");
  nativeProbe.raceAttempt = baseline;
  nativeProbe.raceFile = nonInputRaceFile;
  nativeProbe.raceContent = nonInputRaceContent;
  const unrelatedPath = path.join(workspace.root, "batch-unrelated-candidate.txt");
  const ignoredOutput = path.join(workspace.root, "dist/batch-hashed-a9137.js");
  const candidate = path.join(workspace.root, "node_modules/batch-record-dependency/index.ts");
  const declaration = path.join(workspace.root, "node_modules/batch-record-dependency/index.d.ts");
  const unrelatedPackageFile = path.join(workspace.root, "node_modules/batch-record-dependency/unrelated.txt");
  const addedRoot = path.join(workspace.root, "src/pooled-membership.d.ts");
  for (const owned of [candidate, unrelatedPackageFile, addedRoot]) assert.equal(fs.existsSync(owned), false);
  const originalDeclaration = fs.readFileSync(declaration);
  const rootCase = compilerUsesCaseSensitiveFileNames({ cacheDir: workspace.cache, projectRoot: workspace.root });
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
  let siblingCase: boolean;
  try {
    Object.defineProperty(process, "platform", { ...platform, value: process.platform === "linux" ? "darwin" : "linux" });
    siblingCase = compilerUsesCaseSensitiveFileNames({ cacheDir: path.join(workspace.root, "sibling-case-cache"), projectRoot: workspace.root });
  } finally {
    Object.defineProperty(process, "platform", platform);
  }
  const workers = (["metro", "turbopack"] as const).map((mode) => createLoaderPoolWorker({
    mode, root: workspace.root, cache: workspace.cache, session,
    metro: pathToFileURL(path.join(lib, "transformer.mjs")).href,
    options: pathToFileURL(path.join(lib, "core/options.mjs")).href,
    turbopack: TestUnpluginRuntime.libUrl("turbopack"),
  }));
  let finalRecord: string | undefined;
  let bodyFailure: unknown;
  try {
  fs.writeFileSync(configPath, JSON.stringify(poolConfig));
  const outcomes = await Promise.allSettled(workers.map((worker) => worker.request()));
  const failures = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
  if (failures.length) throw new AggregateError(failures.map((outcome) => outcome.reason), "loader pool outcomes");
  const [metro, turbopack] = outcomes.map((outcome) => {
    const reply = (outcome as PromiseFulfilledResult<LoaderPoolOutcome>).value;
    assert.equal(reply.error, undefined); return reply.value;
  });
  assert.equal(metro.ast.filename, "src/bundle.ts");
  assert.deepEqual(metro.ast.options, { projectRoot: workspace.root, platform: "ios" });
  assert.deepEqual(metro.ast.plugins, ["authored-babel-plugin"]);
  assert.equal(typeof metro.ast.source, "string");
  assert.match(metro.ast.source, /Shared boundary corpus/);
  assert.doesNotMatch(metro.ast.source, /WRONG ROOT BANNER DECOY/, "explicit nested configFile must win over discovered root config");
  assert.match(metro.ast.source, /Authored source positions remain observable/);
  assert.notEqual(metro.ast.source, fs.readFileSync(path.join(workspace.root, "src/bundle.ts"), "utf8"));
  assert.ok(metro.ast.source.includes("STRIPPED_DEBUG_RAN"), "API source text retains the authored effect; only actual runtime emit invokes the stripped function");
  assert.ok(metro.ast.source.includes('logger.trace("drop")'), "the source lane retains the configured trace call that the runtime emit lane must remove");
  assert.ok(metro.ast.source.includes("TTSC_BATCH_RESULT"));
  assert.equal(metro.outsideProgram.filename, "passthrough/tool.ts");
  assert.equal(metro.outsideProgram.source.replace(/\r\n/g, "\n"), "export const outsideProgram: number = 1;\n", "the actual built adapter must forward an excluded source unchanged without substituting the program's output");
  assert.equal(turbopack.completions, 1);
  assert.deepEqual(turbopack.errors, []);
  assert.deepEqual(turbopack.cacheability, [], "an ordinary native result must not invoke the actual cacheable(false) volatility callback");
  assert.equal(turbopack.value, "authored-marker");
  assert.equal(turbopack.dependencies.length, 1, "the real loader must hand over only the project's record");
  assert.deepEqual(turbopack.contextDependencies, []);
  const projectRecordFile = turbopack.dependencies[0]!;
  assert.equal(path.dirname(projectRecordFile), path.join(workspace.root, ".ttsc", "records"));
  const record = JSON.parse(fs.readFileSync(projectRecordFile, "utf8"));
  assert.equal(record.root, fs.realpathSync.native(workspace.root));
  assert.equal(record.tsconfig, fs.realpathSync.native(path.join(workspace.root, "tsconfig.json")));
  for (const input of [fs.realpathSync.native(path.join(workspace.root, "config/banner.config.json")), fs.realpathSync.native(path.join(workspace.root, "config/strip.config.json")), fs.realpathSync.native(path.join(workspace.root, "src/console.d.ts"))])
    assert.ok(Object.prototype.hasOwnProperty.call(record.inputs, input), `the actual record must carry ${input}`);
  assert.ok(Object.prototype.hasOwnProperty.call(record.inputs, path.join(workspace.root, "src/pool-routing/tsconfig.json")), "the implicit loader selection must retain the files-empty solution that routed to the native root project");
  assert.equal(fs.statSync(workspace.programRunLog).size - baseline, 1, "one actual native ApplyProgram invocation serves the two-worker pool");
  assert.equal(fs.readFileSync(nonInputRaceFile, "utf8"), nonInputRaceContent, "the actual native hook must perform its ignored write during capture");
  assert.equal(Object.prototype.hasOwnProperty.call(record.inputs, nonInputRaceFile), false, "the non-input write must not become a declared native input");
  BatchWorkspace.assertContextReceipts(BatchWorkspace.readContextReceipts(workspace).slice(receiptOffset));
  const caseReports = fs.readFileSync(workspace.casePolicyReceipt, "utf8").split(/\r?\n/).filter(Boolean).slice(caseOffset).map((line) => JSON.parse(line));
  const nativeCase = caseReports.find((report) => report.name === "shared-real-program-probe")?.useCaseSensitiveFileNames;
  assert.equal(typeof nativeCase, "boolean", "the initial actual Program must report its native comparison policy");
  assert.equal(rootCase, nativeCase);
  assert.equal(siblingCase, nativeCase, "the physical root proxy must agree with this actual Program despite the apparent platform");
  finalRecord = projectRecordFile;
  for (const input of [declaration, candidate])
    assert.ok(Object.prototype.hasOwnProperty.call(record.inputs, input), `native resolution must record ${input}`);
  assert.ok(record.membership !== null, "the real record carries project membership");
  const signal = () => fs.readFileSync(projectRecordFile, "utf8");
  const quiet = async (message: string) => {
    const before = signal();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.equal(signal(), before, message);
  };
  const signalBeforeEdit = signal();
  const metadataProgramBaseline = fs.statSync(workspace.programRunLog).size;
  // These inputs have no conflicting values or configuration requirements.
  // One invalidated generation can consume all three changes together.
  fs.appendFileSync(declaration, "export declare const retainedMetadata: 1;\n");
  const candidateSource = "export interface RecordWitness { label: string; native?: 1 }\n";
  const membershipSource = "declare const pooledMembership: 1;\n";
  fs.writeFileSync(candidate, candidateSource);
  fs.writeFileSync(addedRoot, membershipSource);
  await waitFor(() => signal() !== signalBeforeEdit, "the resident record to move for the combined native input epoch");
  const firstSignal = signal();
  await waitFor(() => signal() !== firstSignal, "the same resident record to repeat its unacknowledged move");
  const metadataDelivery = await Promise.all(workers.map((worker) => worker.request()));
  for (const reply of metadataDelivery) assert.equal(reply.error, undefined);
  assert.equal(fs.statSync(workspace.programRunLog).size - metadataProgramBaseline, 1, "one native ApplyProgram admission consumes the combined declaration, candidate and membership epoch");
  assert.deepEqual(metadataDelivery[1]!.value.dependencies, [projectRecordFile]);
  const acknowledged = JSON.parse(signal());
  for (const input of [declaration, candidate, addedRoot])
    assert.ok(Object.prototype.hasOwnProperty.call(acknowledged.inputs, input), `the same native delivery must acknowledge ${input}`);
  assert.equal(fs.readFileSync(declaration, "utf8"), originalDeclaration.toString("utf8") + "export declare const retainedMetadata: 1;\n");
  assert.equal(fs.readFileSync(candidate, "utf8"), candidateSource);
  assert.equal(fs.readFileSync(addedRoot, "utf8"), membershipSource);
  await quiet("one delivery that consumed the combined epoch settles the actual record");
  fs.writeFileSync(unrelatedPackageFile, "unrelated package bytes\n");
  await quiet("unrelated package content does not move the acknowledged record");
  for (const dependency of turbopack.dependencies) {
    assert.ok(fs.existsSync(dependency));
    const relative = path.relative(workspace.root, dependency);
    assert.equal(relative.startsWith("..") || path.isAbsolute(relative), false);
    assert.notEqual(dependency, path.join(workspace.root, "src/map.ts"));
  }
  assert.equal(turbopack.map, undefined, "the native api-transform source-text envelope does not emit a source map");
  assert.equal(turbopack.content.replace(/\r\n/g, "\n"), fs.readFileSync(path.join(workspace.root, "expected-map-source.txt"), "utf8").replace(/\r\n/g, "\n"), "the native preparse banner changes the source text without fabricating an emitted map");
  const publications = () => fs.readdirSync(session).filter((name) => name.endsWith(".json")).sort().map((name) => {
    const value = JSON.parse(fs.readFileSync(path.join(session, name), "utf8"));
    return { name, type: value.result.type, scratchDirectory: value.scratchDirectory };
  });
  // These state transitions keep the same two actual adapter/cache owners.
  fs.appendFileSync(contractPath, "\nexport type PooledBroken = NotARealExternalType;\nexport const pooledAliasInvalid: import(\"@typed/foo\").Foo = { id: \"wrong\", name: 42 };\n");
  const failed = await Promise.all(workers.map((worker) => worker.request()));
  for (const reply of failed) {
    assert.match(reply.error ?? "", /NotARealExternalType/);
    assert.match(reply.error ?? "", /not assignable/, "the independently typed alias cannot collapse to any through a wrapper");
  }
  const failedPublications = publications();
  assert.equal(failedPublications.filter((publication) => publication.type === "failure").length, 1);
  const replay = await Promise.all(workers.map((worker) => worker.request()));
  for (const reply of replay) {
    assert.match(reply.error ?? "", /NotARealExternalType/);
    assert.match(reply.error ?? "", /not assignable/);
  }
  assert.deepEqual(publications(), failedPublications, "both residents reuse the failed publication without publishing another compile");
  fs.writeFileSync(contractPath, originalContract);
  const repaired = await Promise.all(workers.map((worker) => worker.request()));
  for (const reply of repaired) { assert.equal(reply.error, undefined); assert.ok(reply.value); }
  assert.equal(repaired[0]!.value.ast.source, metro.ast.source, "repair restores the actual Metro native output");
  assert.equal(repaired[1]!.value.content, turbopack.content, "repair restores the actual Turbopack native output");
  assert.ok(publications().some((publication) => publication.type === "success"), "repair observes an actual successful publication");
  fs.writeFileSync(bannerPath, JSON.stringify({ text: "Pooled second banner\nIndependent external-config state" }));
  // Disk-source and external configuration changes coexist in this already
  // required epoch. The caller still delivers the previous source bytes.
  for (let index = 0; index < deliveredPaths.length; index++) {
    assert.match(originalDelivered[index]!, /"authored-marker"/);
    fs.writeFileSync(deliveredPaths[index]!, originalDelivered[index]!.replace('"authored-marker"', '"disk-drifted-marker"'));
  }
  const divergentSuffix = "\n// changed by the host before native delivery\n";
  const external = await Promise.all(workers.map((worker, index) => worker.request("", originalDelivered[index])));
  for (const reply of external) { assert.equal(reply.error, undefined); assert.ok(reply.value); }
  assert.match(external[0]!.value.ast.source, /Pooled second banner/);
  assert.doesNotMatch(external[0]!.value.ast.source, /Shared boundary corpus/);
  assert.match(external[0]!.value.ast.source, /"disk-drifted-marker"/);
  assert.doesNotMatch(external[0]!.value.ast.source, /"authored-marker"/);
  assert.equal(external[1]!.value.value, "disk-drifted-marker", "native output must use disk bytes rather than stale delivered text");
  const changedExternal = publications();
  const beforeIgnoredChurn = fs.statSync(workspace.programRunLog).size;
  fs.writeFileSync(unrelatedPath, "Unrelated text is not a resolution/config input.\n");
  fs.mkdirSync(path.dirname(ignoredOutput), { recursive: true });
  fs.writeFileSync(ignoredOutput, "console.log('hashed generated output');\n");
  const externalReplay = await Promise.all(workers.map((worker) => worker.request(divergentSuffix)));
  for (const reply of externalReplay) assert.equal(reply.error, undefined);
  assert.equal(externalReplay[0]!.value.ast.source, external[0]!.value.ast.source);
  assert.equal(externalReplay[1]!.value.content, external[1]!.value.content);
  assert.equal(externalReplay[1]!.value.value, "disk-drifted-marker");
  assert.deepEqual(external[1]!.value.dependencies, [projectRecordFile]);
  assert.deepEqual(externalReplay[1]!.value.dependencies, [projectRecordFile], "a cache delivery must repeat the real project-record handoff");
  assert.deepEqual(external[1]!.value.contextDependencies, []);
  assert.deepEqual(externalReplay[1]!.value.contextDependencies, []);
  assert.deepEqual(external[1]!.value.cacheability, []);
  assert.deepEqual(externalReplay[1]!.value.cacheability, [], "unchanged ordinary cache delivery must not invent volatility");
  assert.deepEqual(publications(), changedExternal, "unrelated candidate-directory and excluded output churn keep the publication");
  assert.equal(fs.statSync(workspace.programRunLog).size, beforeIgnoredChurn, "ignored churn does not invoke native ApplyProgram again");
  // All three transitions affect only this experiment's subtree of the actual
  // excluded outDir. The next existing delivery must retain the publication
  // even if an observer accumulated any of these directory events.
  for (let revision = 0; revision < 3; ++revision) {
    fs.rmSync(recreatedOutputDirectory, { recursive: true, force: true });
    fs.mkdirSync(recreatedOutputDirectory, { recursive: true });
    fs.writeFileSync(path.join(recreatedOutputDirectory, `bundle-${revision}.js`), `export const revision = ${revision};\n`);
  }
  const repeatedDivergence = await Promise.all(workers.map((worker) => worker.request(divergentSuffix)));
  for (const reply of repeatedDivergence) assert.equal(reply.error, undefined);
  assert.equal(repeatedDivergence[0]!.value.ast.source, external[0]!.value.ast.source);
  assert.equal(repeatedDivergence[1]!.value.content, external[1]!.value.content);
  assert.equal(repeatedDivergence[1]!.value.value, "disk-drifted-marker");
  assert.deepEqual(repeatedDivergence[1]!.value.dependencies, [projectRecordFile]);
  assert.deepEqual(repeatedDivergence[1]!.value.contextDependencies, []);
  assert.deepEqual(repeatedDivergence[1]!.value.cacheability, []);
  assert.deepEqual(publications(), changedExternal, "recreated excluded output directories and repeated divergent host text preserve the native generation");
  assert.equal(fs.statSync(workspace.programRunLog).size, beforeIgnoredChurn);
  } catch (error) { bodyFailure = error; } finally {
    fs.writeFileSync(contractPath, originalContract);
    fs.writeFileSync(bannerPath, originalBanner);
    for (let index = 0; index < deliveredPaths.length; index++) fs.writeFileSync(deliveredPaths[index]!, originalDelivered[index]!);
    fs.writeFileSync(declaration, originalDeclaration);
    for (const owned of [candidate, unrelatedPackageFile, addedRoot]) fs.rmSync(owned, { force: true });
    fs.rmSync(unrelatedPath, { force: true });
    fs.rmSync(ignoredOutput, { force: true });
    fs.rmSync(recreatedOutputDirectory, { recursive: true, force: true });
    const closes = await Promise.allSettled(workers.map((worker) => worker.close()));
    const failedCloses = closes.filter((entry): entry is PromiseRejectedResult => entry.status === "rejected");
    const failures: unknown[] = failedCloses.map((entry) => entry.reason);
    if (failedCloses.length === 0) {
      fs.writeFileSync(configPath, originalConfig);
      fs.rmSync(nonInputRaceFile, { force: true });
    }
    if (bodyFailure === undefined && failedCloses.length === 0)
      try { assert.ok(finalRecord !== undefined && fs.existsSync(finalRecord), "joined worker close retains the real record for later sessions"); }
      catch (error) { failures.push(error); }
    if (bodyFailure === undefined && failedCloses.length === 0)
      for (const worker of workers) {
        try { assert.equal(worker.diagnostics().split("differs from the file on disk").length - 1, 1, "each real resident reports divergent delivery once"); }
        catch (error) { failures.push(error); }
      }
    if (bodyFailure !== undefined) failures.unshift(bodyFailure);
    if (failures.length) throw new AggregateError(failures, "resident loader pool delivery and close");
  }
}
