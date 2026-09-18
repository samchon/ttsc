import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies reported graph proof failures fail one shared, bounded generation
 * instead of recompiling per delivered module.
 *
 * A wholly unobserved candidate remains admissible, but a realized edge target
 * whose content proof failed, or an observed candidate carrying
 * `file-exists-changed`, is evidence of a compile race and must refuse reuse.
 * The refusal has to stay one bounded verdict shared by every waiter, replayed
 * until real evidence of change arrives.
 *
 * 1. Request all modules of a four-file project with dropped edge proofs
 *    concurrently, and assert two attempts, one shared terminal error, bounded
 *    witnesses, and the exact producer path.
 * 2. Request later waves with the first module's in-memory overlay intact, and
 *    assert they replay the verdict without compiling.
 * 3. Assert a real disk edit and an explicit cache reset each authorize one new
 *    bounded wave.
 * 4. Report an observed candidate predicate failure and assert it also ends after
 *    two attempts with the exact producer reason and path.
 */
export async function test_transformttsc_reported_graph_proof_failures_fail_after_bounded_attempts(): Promise<void> {
  const {
    createTtscTransformCache,
    resetTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    fileCount: 4,
    graphFanout: 12,
    unprovenGraphInputs: 12,
  });
  const unrelated = path.join(project.root, "fixtures", "unrelated.log");
  fs.mkdirSync(path.dirname(unrelated), { recursive: true });
  fs.writeFileSync(unrelated, "steady\n", "utf8");
  let denyUnrelated = false;
  const referenceDirectories = new Set<string>();
  const cache = createTtscTransformCache({
    lstat: (location: string) => {
      if (path.basename(location) === "clock-reference") {
        referenceDirectories.add(path.dirname(location));
      }
      return fs.lstatSync(location, { bigint: true });
    },
    readFile: (location: string) => {
      if (denyUnrelated && path.resolve(location) === unrelated) {
        const error = new Error(
          "unrelated read denied",
        ) as NodeJS.ErrnoException;
        error.code = "EACCES";
        throw error;
      }
      return fs.readFileSync(location);
    },
  });
  const options = resolveOptions();
  const modules = projectModules(project.root);
  const sources = new Map(
    modules.map((file, index) => [
      file,
      `${fs.readFileSync(file, "utf8")}${index === 0 ? "// in-memory overlay\n" : ""}`,
    ]),
  );
  const settled = await Promise.allSettled(
    modules.map((file) =>
      transformTtsc(file, sources.get(file)!, options, undefined, cache),
    ),
  );
  const failures = settled.map((entry) => {
    assert.equal(entry.status, "rejected");
    return (entry as PromiseRejectedResult).reason as Error;
  });
  assert.ok(
    failures.every((failure) => failure === failures[0]),
    "all concurrent modules must receive the shared generation failure",
  );
  assert.match(failures[0]!.message, /after 2 attempts/);
  assert.match(failures[0]!.message, /graph\/proof-missing/);
  assert.match(failures[0]!.message, /node_modules\/dep0\/index\.d\.ts/);
  assert.match(failures[0]!.message, /producer: "content-unavailable"/);
  assert.match(failures[0]!.message, /additional witness\(es\) omitted/);
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "persistent proof failure must be bounded by attempts, not module count",
  );
  assert.equal(
    cache.size,
    1,
    "the terminal failed generation must remain authoritative",
  );
  assert.ok(
    referenceDirectories.size >= 2,
    "each bounded attempt must mint its own clock reference",
  );
  assert.ok(
    [...referenceDirectories].every(
      (referenceDirectory) => !fs.existsSync(referenceDirectory),
    ),
    "a terminal failed generation must release every clock reference",
  );
  denyUnrelated = true;
  for (const file of modules) {
    await assert.rejects(
      () => transformTtsc(file, sources.get(file)!, options, undefined, cache),
      (error: Error) => error === failures[0],
    );
  }
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "later request waves must reuse the verdict until an input changes",
  );
  denyUnrelated = false;

  const edited = modules[1]!;
  const editedSource = `${sources.get(edited)!}// disk edit\n`;
  fs.writeFileSync(edited, editedSource, "utf8");
  const unchangedSibling = modules[2]!;
  let editedFailure: Error | undefined;
  await assert.rejects(
    () =>
      transformTtsc(
        unchangedSibling,
        sources.get(unchangedSibling)!,
        options,
        undefined,
        cache,
      ),
    (error: Error) => {
      editedFailure = error;
      return error !== failures[0];
    },
  );
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    4,
    "a real input edit must authorize one new bounded wave",
  );

  resetTtscTransformCache(cache);
  await assert.rejects(
    () =>
      transformTtsc(
        modules[0]!,
        sources.get(modules[0]!)!,
        options,
        undefined,
        cache,
      ),
    (error: Error) => error !== editedFailure,
  );
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    6,
    "an explicit cache lifecycle reset must authorize one new bounded wave",
  );

  const candidateProject = createCacheProject({
    candidateProofFailure: true,
    fileCount: 1,
    graphCandidates: 1,
    graphFanout: 1,
  });
  const candidateCache = createTtscTransformCache();
  const candidateMain = projectModules(candidateProject.root)[0]!;
  await assert.rejects(
    () =>
      transformTtsc(
        candidateMain,
        fs.readFileSync(candidateMain, "utf8"),
        resolveOptions(),
        undefined,
        candidateCache,
      ),
    (error: Error) =>
      /after 2 attempts/.test(error.message) &&
      /graph\/proof-missing/.test(error.message) &&
      /node_modules[/\\]dep0[/\\]index\.ts/.test(error.message) &&
      /producer: "file-exists-changed"/.test(error.message),
  );
  assert.equal(
    fs.readFileSync(candidateProject.runLog, "utf8").length,
    2,
    "an observed speculative predicate failure must not receive the unobserved-candidate exemption",
  );

  // A cleanup failure happens before the capture can transfer any retained
  // resources to its caller. The probe must still be released even though the
  // ordinary return value never reaches the terminal-generation disposer.
  const cleanupProject = createCacheProject({
    fileCount: 1,
    graphFanout: 1,
    unprovenGraphInputs: 1,
  });
  const cleanupReferenceDirectories = new Set<string>();
  const closedWatchers = new Set<number>();
  let openedWatchers = 0;
  const cleanupCache = createTtscTransformCache({
    lstat: (location: string) => {
      if (path.basename(location) === "clock-reference") {
        cleanupReferenceDirectories.add(path.dirname(location));
      }
      return fs.lstatSync(location, { bigint: true });
    },
    watch: () => {
      const watcher = openedWatchers++;
      return {
        close: () => {
          closedWatchers.add(watcher);
          if (watcher === 0) {
            throw new Error("forced tracker cleanup failure");
          }
        },
      };
    },
  });
  const cleanupMain = projectModules(cleanupProject.root)[0]!;
  await assert.rejects(
    () =>
      transformTtsc(
        cleanupMain,
        fs.readFileSync(cleanupMain, "utf8"),
        resolveOptions(),
        undefined,
        cleanupCache,
      ),
    /forced tracker cleanup failure/,
  );
  assert.ok(
    cleanupReferenceDirectories.size > 0,
    "the failed capture must have minted a clock reference",
  );
  assert.ok(
    openedWatchers > 1,
    "the cleanup fixture must own multiple watcher handles",
  );
  assert.equal(
    closedWatchers.size,
    openedWatchers,
    "one throwing close must not abandon later watcher handles",
  );
  assert.ok(
    [...cleanupReferenceDirectories].every(
      (referenceDirectory) => !fs.existsSync(referenceDirectory),
    ),
    "fallible local cleanup must release an untransferred clock reference",
  );
}
