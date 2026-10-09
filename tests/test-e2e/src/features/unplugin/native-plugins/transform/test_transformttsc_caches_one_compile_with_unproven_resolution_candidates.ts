import assert from "node:assert/strict";
import path from "node:path";

import type { ICandidateFilesystemIo } from "../../../../internal/unplugin/internal/transform-project-cache/ICandidateFilesystemIo";
import { runProjectBuild } from "../../../../internal/unplugin/internal/transform-project-cache/runProjectBuild";

/**
 * Verifies a graph carrying superseding resolution candidates still compiles
 * the project once (samchon/ttsc#1245).
 *
 * A candidate is a spelling strictly ahead of the resolution target that won,
 * so the compiler never selected it and usually never read it, and no
 * compile-time proof for it can exist. Requiring one made
 * `projectSnapshotComplete` false for every project that resolves a dependency
 * through a declaration file, so every refusal evicted the generation and the
 * next module recompiled forever. A rich predicate proof must supersede an
 * unrepresentable legacy one without concealing a contradiction, and replaying
 * it must not read candidate content.
 *
 * 1. Build a six-file project whose graph stamps three unproven candidates per
 *    module, and assert one compile.
 * 2. Report rich, contradictory, and unprojectable candidate proofs, and assert
 *    each is honored or refused as its evidence allows.
 * 3. Assert replaying a candidate predicate costs only its bounded stat, read, and
 *    realpath calls.
 *
 * @evidence contracts/testing.md#behavioral-verification Native candidate envelopes allow one compile across six outputs, preserve rich missing/not-file evidence, refuse conflicting rich/legacy proofs after two attempts, and obey exact candidate I/O bounds.
 * @evidence contracts/testing.md#independent-expectations Handwritten candidate predicates and contradiction options establish admission/rejection; independent filesystem counters measure replay rather than deriving expected output from cache internals.
 * @evidence contracts/testing.md#distinguishing-cases Absent candidates, representable rich proof, contradictory rich proof and unprojectable contradiction contrast; successful replay reads no candidate content.
 * @evidence contracts/testing.md#execution-ownership The ordinary tests/test-e2e/src/index.ts run selects nine batch entries whose import graph excludes this retained module, so that suite does not execute this declaration. If explicitly invoked, test_transformttsc_caches_one_compile_with_unproven_resolution_candidates owns runProjectBuild native envelope variants and candidate-proof admission/I/O assertions. Evidence selection does not establish runtime coverage.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Native candidate envelopes allow one compile across six outputs, preserve rich missing/not-file evidence, refuse conflicting rich/legacy proofs after two attempts, and obey exact candidate I/O bounds. These assertions remain in test_transformttsc_caches_one_compile_with_unproven_resolution_candidates, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_caches_one_compile_with_unproven_resolution_candidates(): Promise<void> {
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
