import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { activeResourceSummary } from "../../../../internal/unplugin/internal/activeResourceSummary";
import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies persistent validation reads only each file's own graph inputs while
 * keeping every relevant invalidation.
 *
 * Reading the whole envelope on every delivery would cost O(modules x inputs)
 * per build. Narrowing to each file's reachable inputs must not lose freshness:
 * an absence the proof cannot observe, a reachable edit, a membership change, a
 * broken host-input link whose remote target appears, and an out-of-project
 * descriptor dependency must all still replace the generation.
 *
 * A delivery also re-reads the identity of every directory its trackers watch:
 * the project root under each of its spellings, the descriptor directory, and
 * the ancestor holding each missing probe, up to the volume root. Their number
 * follows the depth of the temporary directory and the fixture's topology, not
 * the graph, so they are bounded by a property instead: each is read once per
 * delivery. Where the watch cannot prove a location delivers, as macOS cannot
 * for a directory outside the project, the universal inputs there are proven by
 * metadata instead: one read per spelling an input is named under, since a
 * spelling through a link, every macOS temporary path among them, is an input
 * of its own beside the physical one the compiler reports, and a link among
 * them costs a stat of its target. Those reads are bounded the same way: each
 * spelling once per delivery, or twice for an input whose proof is re-earned on
 * every delivery, the broken link here, which is read on each side of its
 * content comparison; and in number by the inputs the fixture declares.
 *
 * The descriptor's absent inputs are proven by a native stat of each on every
 * delivery: a directory listing cannot see a short-name or Unicode alias, and a
 * watch cannot match an event to an absent spelling. Their number is the
 * fixture's, so they are bounded by a property as well, each probed once per
 * delivery, while the per-module stat bound counts every other file.
 *
 * 1. Deliver twelve modules over a partitioned graph and assert reads, file stats,
 *    and metadata checks per module stay within their bounds, and that no
 *    watched directory, input spelling or absent input is read twice in one
 *    delivery.
 * 2. Deny the stat that proves a candidate missing and assert the generation is
 *    replaced, then edit an unreachable external and an unclassified asset and
 *    assert neither replaces it.
 * 3. Edit a reachable external, include a new source, create a broken link's
 *    remote target, and edit a descriptor dependency, and assert each replaces
 *    it.
 *
 * @evidence contracts/testing.md#behavioral-verification Partitioned native graph keeps per-delivery read/stat/metadata bounds and no duplicate watched-directory checks while retaining required invalidations and ignoring unreachable inputs.
 * @evidence contracts/testing.md#independent-expectations Independent per-cache counters, handwritten graph partition and literal mutations define workload/freshness; observed hashes are checked for proof presence, not used to manufacture expected output.
 * @evidence contracts/testing.md#distinguishing-cases Denied candidate stat, unreachable external/noninput, POSIX broken-link target appearance, reachable external, new source and descriptor dependency edit are separately asserted.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_persistent_validation_uses_per_file_inputs owns deliveries across a twelve-module native graph with local I/O counters and separate freshness mutations. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Partitioned native graph keeps per-delivery read/stat/metadata bounds and no duplicate watched-directory checks while retaining required invalidations and ignoring unreachable inputs. These assertions remain in test_transformttsc_persistent_validation_uses_per_file_inputs, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_validation_uses_per_file_inputs(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const count = 12;
  const project = createCacheProject({
    fileCount: count,
    graphFanout: count,
    isolatedPluginSource: true,
    partitionGraph: true,
    unrelatedDirectoryCount: 48,
  });
  const descriptorSelection = path.join(
    TestProject.tmpdir("ttsc-unplugin-descriptor-selection-"),
    "selection.cjs",
  );
  // The selection's own package scope. The descriptor evaluator records the
  // scope of every module it loads, and without one here that is the shared
  // temporary directory's, whose absent `package.json` is proven by that
  // directory's metadata, which every other process writing there moves.
  fs.writeFileSync(
    path.join(path.dirname(descriptorSelection), "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }),
    "utf8",
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
    // A link with no target is reproducible on Windows as a junction, which
    // needs no elevation. What is not is the second half of this edge: a
    // junction whose target is later created as a *file* still reports ENOENT
    // through the link, measured on Windows 11, so the appearance this asserts
    // below can only be observed through a POSIX file symlink. POSIX CI owns
    // it while the shared case retains every other assertion on all platforms.
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
  // The spellings whose metadata the delivery in progress read.
  let metadataReads: string[] = [];
  let stats = 0;
  // The directories statted by the delivery in progress, the watched
  // locations' identity checks among them.
  let directoryStats: string[] = [];
  // The product frames of each directory stat, so a repeated read names the
  // validators that both read it.
  let directoryStatCallers: string[] = [];
  // The descriptor's absent inputs, keyed by physical directory and name,
  // whose stats are bounded per delivery rather than per module.
  const absentProbes = new Set(
    descriptorProbes.filter((probe) => !lexicallyExists(probe)).map(absenceKey),
  );
  // The absent inputs the delivery in progress statted.
  let absenceStats: string[] = [];
  // Whether the next stat of an absent input fails with a permission error.
  let denyAbsenceProof = false;
  const recordStat = <T extends { isDirectory(): boolean }>(
    location: string,
    stat: () => T,
  ): T => {
    let target: T;
    try {
      if (denyAbsenceProof && absentProbes.has(absenceKey(location))) {
        denyAbsenceProof = false;
        const error = new Error("permission denied") as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      target = stat();
    } catch (error) {
      const key = absenceKey(location);
      if (absentProbes.has(key)) absenceStats.push(key);
      else stats += 1;
      throw error;
    }
    if (target.isDirectory()) {
      directoryStats.push(path.resolve(location));
      directoryStatCallers.push(callerFrames());
    } else stats += 1;
    return target;
  };
  const cache = createTtscTransformCache({
    lstat: (location: string) => {
      lstats += 1;
      metadataReads.push(path.resolve(location));
      return fs.lstatSync(location, { bigint: true });
    },
    readFile: (location: string) => {
      reads += 1;
      return fs.readFileSync(location);
    },
    stat: (location: string) =>
      recordStat(location, () => fs.statSync(location)),
    statBigInt: (location: string) =>
      recordStat(location, () => fs.statSync(location, { bigint: true })),
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
    directoryStats = [];
    directoryStatCallers = [];
    metadataReads = [];
    absenceStats = [];
    assert.ok(await deliver(file));
    assert.equal(
      new Set(absenceStats).size,
      absenceStats.length,
      `a delivery probes each absent input once: ${absenceStats.join(", ")}`,
    );
    assert.equal(
      new Set(directoryStats).size,
      directoryStats.length,
      `a delivery reads each watched directory once (active resources: ${activeResourceSummary()}; host tracker: ${trackerState(capturedHostTracker)}; validated but not tracker-covered: ${uncoveredInputs(capturedGeneration, capturedHostTracker)}): ${directoryStats.map((location, index) => `${location}\n${directoryStatCallers[index]}`).join("\n")}`,
    );
    const spellings = new Set(metadataReads);
    assert.ok(
      metadataReads.length <= spellings.size + 1,
      `a delivery reads each input spelling's metadata once, and the broken link on each side of its content comparison: ${metadataReads.join(", ")}`,
    );
  }
  assert.ok(
    reads / modules.length <= 12,
    `persistent validation read ${(reads / modules.length).toFixed(1)} files per module (bound: 12; complete=${String(capturedGeneration.projectSnapshotComplete)}; projectTracker=${String(capturedProjectTracker?.failed)}/${String(capturedProjectTracker?.membershipChanged)}; hostTracker=${String(capturedHostTracker?.failed)}/${String(capturedHostTracker?.membershipChanged)}; generationReplaced=${String([...cache.values()][0] !== capturedPromise)}; pluginRuns=${fs.existsSync(project.runLog) ? fs.readFileSync(project.runLog, "utf8").length : 0}; hostInputs=${capturedGeneration.result.type === "exception" ? 0 : (capturedGeneration.result.hostInputs?.length ?? 0)}; unhashed=${unhashedInputs.length}:${unhashedInputs.slice(0, 3).join(",")})`,
  );
  assert.ok(
    stats / modules.length <= 12,
    `persistent validation statted ${(stats / modules.length).toFixed(1)} files per module beside the ${absentProbes.size} absent inputs (bound: 12)`,
  );
  // The manifest reads each existing universal input once per spelling; the
  // fixture declares its inputs under one spelling each, so a delivery reading
  // the per-file graph as well, or the manifest twice, exceeds their number.
  assert.ok(
    lstats / modules.length <= descriptorProbes.length,
    `persistent validation metadata-checked ${(lstats / modules.length).toFixed(1)} input spellings per module (bound: ${descriptorProbes.length})`,
  );

  const main = modules[0]!;
  let originalGeneration = [...cache.values()][0];
  denyAbsenceProof = true;
  assert.ok(await deliver(main));
  assert.equal(denyAbsenceProof, false, "the delivery probes an absent input");
  const permissionRetryGeneration = [...cache.values()][0];
  assert.notEqual(
    permissionRetryGeneration,
    originalGeneration,
    "a denied absence probe cannot certify that its candidate remains missing",
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

/** Whether a path has a directory entry, a broken link among them. */
function lexicallyExists(location: string): boolean {
  try {
    fs.lstatSync(location);
    return true;
  } catch {
    return false;
  }
}

/**
 * One absent path under every spelling of its directory: the physical directory
 * joined with the requested name, so a macOS temporary path and its `/private`
 * target name the same probe.
 */
function absenceKey(location: string): string {
  const directory = path.dirname(path.resolve(location));
  let physical = directory;
  try {
    physical = fs.realpathSync.native(directory);
  } catch {}
  const key = path.join(physical, path.basename(location));
  return process.platform === "win32" ? key.toLowerCase() : key;
}

/** The product frames that reached a recorded filesystem operation. */
function callerFrames(): string {
  return (new Error().stack ?? "")
    .split("\n")
    .filter((line) => /[\\/]packages[\\/]unplugin[\\/]/.test(line))
    .slice(0, 6)
    .map((line) => "    " + line.trim())
    .join("\n");
}

/**
 * Why a host-input tracker may not prove its inputs: its failure flags, the
 * watches that could not prove delivery and the changes it recorded.
 */
function trackerState(tracker: unknown): string {
  if (tracker === undefined) return "absent";
  const state = tracker as {
    failed?: boolean;
    unverified?: boolean;
    changesOmitted?: boolean;
    contentAuthoritative?: boolean;
    covered?: ReadonlySet<string>;
    unproven?: ReadonlySet<string>;
    changes?: ReadonlySet<string>;
  };
  return JSON.stringify({
    failed: state.failed,
    unverified: state.unverified,
    changesOmitted: state.changesOmitted,
    contentAuthoritative: state.contentAuthoritative,
    covered: state.covered?.size,
    unproven: [...(state.unproven ?? [])],
    changes: [...(state.changes ?? [])].slice(0, 8),
  });
}

/**
 * The validated host inputs the tracker does not cover, whose presence alone
 * sends every universal input back to the disk.
 */
function uncoveredInputs(generation: unknown, tracker: unknown): string {
  const validated = (
    generation as { hostInputValidation?: { covered?: ReadonlySet<string> } }
  ).hostInputValidation?.covered;
  const covered = (tracker as { covered?: ReadonlySet<string> } | undefined)
    ?.covered;
  if (validated === undefined) return "no validation";
  const missing = [...validated].filter(
    (input) => covered?.has(input) !== true,
  );
  return JSON.stringify({
    validated: validated.size,
    uncovered: missing.length,
    first: missing.slice(0, 12),
  });
}
