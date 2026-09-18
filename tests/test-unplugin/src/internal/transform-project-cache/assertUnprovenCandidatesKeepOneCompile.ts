import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import type { ICandidateFilesystemIo } from "./ICandidateFilesystemIo";
import { runProjectBuild } from "./runProjectBuild";

/**
 * Asserts samchon/ttsc#1245: a graph carrying superseding resolution candidates
 * still compiles the project once.
 *
 * A candidate is a spelling strictly ahead of the resolution target that won,
 * so the compiler never selected it and usually never read it: no compile-time
 * proof for it can exist. Requiring one made `projectSnapshotComplete` false
 * for every generation of every project that resolves a dependency through a
 * declaration file, which closed the build-scoped shortcut, the narrow
 * persistent path, and complete-snapshot validation at once. Each refusal
 * evicts the generation, so the next module recompiled the whole project and
 * produced another unprovable generation, forever.
 *
 * 1. Build a six-file project whose envelope stamps three unproven candidates per
 *    module.
 * 2. Run a transform over every module sharing one persistent cache.
 * 3. Assert the plugin ran exactly once, not once per module.
 */
export async function assertUnprovenCandidatesKeepOneCompile(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { pluginRuns, outputs } = await runProjectBuild({
    fileCount: 6,
    graphCandidates: 3,
    graphFanout: 4,
  });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
  for (const code of outputs) {
    assert.match(code, /PROBED/);
  }

  const richCandidateFilesystemIo: ICandidateFilesystemIo = {
    readFile: 0,
    realpath: 0,
    stat: 0,
  };
  const rich = await runProjectBuild({
    candidateFilesystemIo: richCandidateFilesystemIo,
    captureWatchEvidence: true,
    fileCount: 1,
    graphCandidates: 2,
    graphFanout: 1,
    richCandidateProof: true,
  });
  assert.equal(
    rich.pluginRuns,
    1,
    "a valid rich speculative proof must supersede its unrepresentable legacy projection",
  );
  assert.equal(rich.outputs.length, 1);
  const richMissingCandidate = path.join(
    rich.root,
    "node_modules",
    "dep1",
    "index.ts",
  );
  const richMissingEvidence = rich.watchInputs.find(
    ({ input }) => path.resolve(input) === richMissingCandidate,
  )?.evidence;
  assert.ok(richMissingEvidence);
  assert.equal(
    richMissingEvidence.missing,
    true,
    "a rich failed-file predicate must preserve the public missing signal",
  );
  assert.equal(richMissingEvidence.unavailable, "not-file");

  await assert.rejects(
    () =>
      runProjectBuild({
        contradictoryRichCandidateProof: true,
        fileCount: 1,
        graphCandidates: 1,
        graphFanout: 1,
      }),
    /after 2 attempts[\s\S]*graph\/proof-conflict[\s\S]*node_modules[/\\]dep0[/\\]index\.ts/,
    "a rich speculative proof must not conceal a contradictory legacy proof",
  );

  const conflictingCandidateFilesystemIo: ICandidateFilesystemIo = {
    readFile: 0,
    realpath: 0,
    stat: 0,
  };
  await assert.rejects(
    () =>
      runProjectBuild({
        candidateFilesystemIo: conflictingCandidateFilesystemIo,
        fileCount: 1,
        graphCandidates: 1,
        graphFanout: 1,
        unprojectableContradictoryRichCandidateProof: true,
      }),
    /after 2 attempts[\s\S]*graph\/proof-conflict[\s\S]*node_modules[/\\]dep0[/\\]index\.ts[\s\S]*producer: "content-unavailable"/,
    "an unprojectable rich predicate must conflict with a supplied legacy proof",
  );
  assert.equal(
    richCandidateFilesystemIo.readFile,
    0,
    "replaying fileExists must not read candidate content",
  );
  // A rejected generation deliberately snapshots every external input once so
  // the retry diagnostic can detect an environmental change. After removing
  // that one stat/read/realpath per attempt, the consistency conflict must be
  // operation-for-operation the same filesystem workload as replaying the rich
  // proof.
  assert.deepEqual(
    conflictingCandidateFilesystemIo,
    {
      readFile: richCandidateFilesystemIo.readFile * 2 + 2,
      realpath: richCandidateFilesystemIo.realpath * 2 + 2,
      stat: richCandidateFilesystemIo.stat * 2 + 2,
    },
    "each rejected attempt must add only its one stat/read/realpath retry snapshot to the rich predicate baseline",
  );
}
