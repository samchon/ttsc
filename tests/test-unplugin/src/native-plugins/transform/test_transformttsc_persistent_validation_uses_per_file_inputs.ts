import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies persistent validation reads only each file's own graph inputs while
 * keeping every relevant invalidation.
 *
 * Reading the whole envelope on every delivery would cost O(modules x inputs)
 * per build. Narrowing to each file's reachable inputs must not lose freshness:
 * a directory the proof cannot read, a reachable edit, a membership change, a
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
 * them costs a stat of its target. Those reads are bounded the same way, each
 * spelling once per delivery, and in number by the inputs the fixture
 * declares.
 *
 * 1. Deliver twelve modules over a partitioned graph and assert reads, file stats,
 *    and metadata checks per module stay within their bounds, and that no
 *    watched directory or input spelling is read twice in one delivery.
 * 2. Deny the directory that proves candidates missing and assert the generation
 *    is replaced, then edit an unreachable external and an unclassified asset
 *    and assert neither replaces it.
 * 3. Edit a reachable external, include a new source, create a broken link's
 *    remote target, and edit a descriptor dependency, and assert each replaces
 *    it.
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
  const recordStat = <T extends { isDirectory(): boolean }>(
    location: string,
    stat: () => T,
  ): T => {
    let target: T;
    try {
      target = stat();
    } catch (error) {
      stats += 1;
      throw error;
    }
    if (target.isDirectory()) directoryStats.push(path.resolve(location));
    else stats += 1;
    return target;
  };
  let deniedDirectory: string | undefined;
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
    metadataReads = [];
    assert.ok(await deliver(file));
    assert.equal(
      new Set(directoryStats).size,
      directoryStats.length,
      `a delivery reads each watched directory once: ${directoryStats.join(", ")}`,
    );
    assert.equal(
      new Set(metadataReads).size,
      metadataReads.length,
      `a delivery reads each input spelling's metadata once: ${metadataReads.join(", ")}`,
    );
  }
  assert.ok(
    reads / modules.length <= 12,
    `persistent validation read ${(reads / modules.length).toFixed(1)} files per module (bound: 12; complete=${String(capturedGeneration.projectSnapshotComplete)}; projectTracker=${String(capturedProjectTracker?.failed)}/${String(capturedProjectTracker?.membershipChanged)}; hostTracker=${String(capturedHostTracker?.failed)}/${String(capturedHostTracker?.membershipChanged)}; generationReplaced=${String([...cache.values()][0] !== capturedPromise)}; pluginRuns=${fs.existsSync(project.runLog) ? fs.readFileSync(project.runLog, "utf8").length : 0}; hostInputs=${capturedGeneration.result.type === "exception" ? 0 : (capturedGeneration.result.hostInputs?.length ?? 0)}; unhashed=${unhashedInputs.length}:${unhashedInputs.slice(0, 3).join(",")})`,
  );
  assert.ok(
    stats / modules.length <= 12,
    `persistent validation statted ${(stats / modules.length).toFixed(1)} files per module (bound: 12)`,
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
