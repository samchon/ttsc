import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PINNED_TICK } from "../../internal/transform-project-cache/PINNED_TICK";
import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { createTickPinnedFilesystem } from "../../internal/transform-project-cache/createTickPinnedFilesystem";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies an input re-earns its metadata signature once the clock provably
 * leaves its stamp's tick.
 *
 * Until then the content comparison must keep running without costing the
 * generation. Anything that makes the clock untrustworthy, a rollback, a failed
 * probe, or a reference from another device, must restore content validation,
 * so a hidden rewrite during it is still caught.
 *
 * 1. Compile with a stamp at the reference tick and assert it keeps the content
 *    comparison, then re-earns its signature without recompiling once the clock
 *    moves on.
 * 2. Roll the clock back, fail the probe, and use a reference from another device,
 *    in turn.
 * 3. Assert each restores content validation, and a hidden rewrite during it
 *    replaces the generation.
 */
export async function test_transformttsc_separated_stamp_re_earns_its_signature(): Promise<void> {
  const {
    createTtscTransformCache,
    resetTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 4,
    graphFanout: 4,
    graphGlobals: 4,
  });
  const modules = projectModules(project.root);
  const reads: string[] = [];
  const inputDevice = fs.lstatSync(project.root, { bigint: true }).dev;
  const pinned = createTickPinnedFilesystem({
    device: inputDevice,
    reads,
    watch: "silent",
  });
  const cache = createTtscTransformCache(pinned.operations);
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

  // Inside one unfinished tick nothing may be proven by metadata, so a steady
  // delivery keeps re-reading its inputs.
  reads.length = 0;
  assert.ok(await deliver(modules[0]!));
  assert.ok(
    reads.length > 0,
    "an unseparated stamp must keep the content comparison",
  );

  // The adapter's freshly written probe moves past the pinned input tick. The
  // next content comparisons may record signatures, and later deliveries stop
  // re-reading everything...
  const touched = path.join(
    project.root,
    "node_modules",
    "global0",
    "index.d.ts",
  );
  pinned.reference.stamp = PINNED_TICK + 1n;
  pinned.stamps.set(touched, PINNED_TICK + 1n);
  // One full pass lets another module's closure prove every delivered module,
  // since a file is excluded from its own derived set. The four-module mesh
  // also proves every shared global except the one kept at the reference tick.
  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  reads.length = 0;
  assert.ok(await deliver(modules[3]!));
  // ...except the one input now sitting at the reference tick itself, whose own
  // tick is not provably over: exactly it keeps the read.
  assert.deepEqual(
    reads,
    [path.resolve(touched)],
    "a re-proven generation must re-read only the input at the reference tick",
  );
  assert.equal(pluginRuns(), 1, "re-earning must never cost the generation");
  assert.equal([...cache.values()][0], generation);

  // A same-device reference that was safe when the signatures were earned can
  // become unsafe after that filesystem clock rolls back. The process clock is
  // still decades ahead of this fixture, so an absolute process-clock bound
  // would incorrectly keep the old signatures authoritative.
  const rolledBackInput = path.join(
    project.root,
    "node_modules",
    "global1",
    "index.d.ts",
  );
  fs.writeFileSync(
    rolledBackInput,
    "declare const ambient1: string;\n",
    "utf8",
  );
  pinned.reference.stamp = PINNED_TICK;
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    2,
    "a clock rollback must restore content validation before metadata reuse",
  );
  assert.notEqual(
    [...cache.values()][0],
    generation,
    "a hidden rewrite during clock rollback must replace the generation",
  );

  // Re-earn signatures on the replacement before isolating a failed probe
  // observation. Keeping the old reference here would wrongly authorize the
  // next same-length rewrite.
  pinned.reference.stamp = PINNED_TICK + 1n;
  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  const generationBeforeUnavailableReference = [...cache.values()][0];
  const unavailableInput = path.join(
    project.root,
    "node_modules",
    "global2",
    "index.d.ts",
  );
  fs.writeFileSync(
    unavailableInput,
    "declare const ambient2: string;\n",
    "utf8",
  );
  pinned.reference.available = false;
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    3,
    "a failed probe observation must restore content validation",
  );
  assert.notEqual(
    [...cache.values()][0],
    generationBeforeUnavailableReference,
    "a hidden rewrite during probe failure must replace the generation",
  );

  // Re-earn once more, then prove that a reference from another reported
  // device cannot authorize metadata-only reuse for the project device.
  pinned.reference.available = true;
  for (const file of modules) {
    assert.ok(await deliver(file));
  }
  const generationBeforeDeviceMismatch = [...cache.values()][0];
  const mismatchedDeviceInput = path.join(
    project.root,
    "node_modules",
    "global3",
    "index.d.ts",
  );
  fs.writeFileSync(
    mismatchedDeviceInput,
    "declare const ambient3: string;\n",
    "utf8",
  );
  pinned.reference.device = inputDevice + 1n;
  assert.ok(await deliver(modules[0]!));
  assert.equal(
    pluginRuns(),
    4,
    "a reference from another device must restore content validation",
  );
  assert.notEqual(
    [...cache.values()][0],
    generationBeforeDeviceMismatch,
    "a hidden rewrite under a device mismatch must replace the generation",
  );

  pinned.reference.device = inputDevice;
  const retainedReferenceDirectories = [...pinned.reference.directories].filter(
    (referenceDirectory) => fs.existsSync(referenceDirectory),
  );
  assert.ok(
    retainedReferenceDirectories.length > 0,
    "a persistent generation must retain its refreshable clock probe",
  );
  const retainedWatchers = [...pinned.watchers.active];
  assert.ok(
    retainedWatchers.length > 1,
    "a persistent generation must retain multiple watcher handles",
  );
  pinned.watchers.fail = retainedWatchers[0];
  resetTtscTransformCache(cache);
  await Promise.resolve();
  assert.ok(
    retainedReferenceDirectories.every(
      (referenceDirectory) => !fs.existsSync(referenceDirectory),
    ),
    "cache disposal must remove the retained clock probe",
  );
  assert.ok(
    retainedWatchers.every((watcher) => pinned.watchers.closed.has(watcher)),
    "one published watcher failure must not abandon another watcher",
  );
  assert.equal(
    pinned.watchers.active.size,
    0,
    "published disposal must detach every watcher before closing it",
  );
  const closedWatchers = pinned.watchers.closed.size;
  resetTtscTransformCache(cache);
  await Promise.resolve();
  assert.equal(
    pinned.watchers.closed.size,
    closedWatchers,
    "repeated cache disposal must not retry detached watcher handles",
  );
}
