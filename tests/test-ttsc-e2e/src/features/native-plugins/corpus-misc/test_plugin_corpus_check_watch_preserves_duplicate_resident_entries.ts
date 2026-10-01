import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
} from "../../../internal/plugin-corpus";
import { WatchSession } from "../../../internal/watch";

type ResidentSample = {
  pid: number;
  programLoads: number;
  programUpdates: number;
  reused: boolean;
};

/**
 * Verifies check watch preserves duplicate resident plugin entries.
 *
 * Resident processes are shared by binary/name/argument identity, but
 * configured plugin entries remain separate executions. Buffering filesystem
 * changes by process key would let the first entry consume the second entry's
 * request and send `undefined` framing instead of preserving both diagnostic
 * batches.
 *
 * 1. Configure the same warning-producing lint plugin entry twice.
 * 2. Start no-emit watch and require both entries to report through one PID.
 * 3. Edit a known source and require both entries to receive the update.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watch produces two initial request samples through one PID, then two incremental samples with the exact load/update/reuse counters and no invalid-request framing.
 * @evidence contracts/testing.md#independent-expectations Two identical configured entries independently require two execution observations while binary/name/argv identity permits one process; literal sample counters distinguish lost or duplicated requests.
 * @evidence contracts/testing.md#distinguishing-cases Owns duplicate descriptor executions at startup and after one source edit, including distinct request buffering through a shared resident; it does not assert the diagnostic bodies beyond framing and counters.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-misc export owns one actual native WatchSession with two configured entries in the Linux batch.
 * @evidence contracts/e2e.md#necessary-boundary Per-entry change delivery must survive process pooling and actual request framing; directly checking a deduplication key cannot prove both native requests are sent and parsed.
 * @evidence contracts/e2e.md#shared-execution The two entries share one unchanged lint binary, watcher and resident PID, with batch plugin/Go caches; no per-entry native producer is built.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The duplicate config and mutable source are local to this fixture, process identity is observed from telemetry rather than invented, and finally closes the watcher; exact sample cardinality remains strict.
 * @evidence contracts/e2e.md#preserved-coverage All original initial and updated sample cardinalities, complete counter tables and negative invalid-request assertions remain. Warning-rule semantics are owned by Go units rather than falsely certified by telemetry alone.
 */
export async function test_plugin_corpus_check_watch_preserves_duplicate_resident_entries(): Promise<void> {
  const root = setupLintProject("lint-violations");
  const tsconfig = path.join(root, "tsconfig.json");
  const project = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
    compilerOptions: {
      plugins: Record<string, unknown>[];
    };
  };
  project.compilerOptions.plugins = [
    project.compilerOptions.plugins[0]!,
    project.compilerOptions.plugins[0]!,
  ];
  fs.writeFileSync(tsconfig, JSON.stringify(project), "utf8");
  fs.writeFileSync(
    path.join(root, "lint.config.json"),
    JSON.stringify({ rules: { "no-var": "warning" } }),
  );
  const source = path.join(root, "src", "main.ts");
  fs.writeFileSync(
    source,
    "var legacy = 1;\nJSON.stringify(legacy);\n",
    "utf8",
  );

  const session = new WatchSession(root, {
    args: ["--noEmit", "--diagnostics"],
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  try {
    await session.waitForBuilds(1, 300_000);
    let transcript = session.transcript();
    let samples = residentSamples(transcript);
    assert.equal(samples.length, 2, transcript);
    assert.deepEqual(
      samples[0],
      {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 0,
        reused: false,
      },
      transcript,
    );
    assert.deepEqual(
      samples[1],
      {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 0,
        reused: true,
      },
      transcript,
    );
    assert.doesNotMatch(transcript, /invalid request/i);

    fs.writeFileSync(
      source,
      "var refreshed = 2;\nJSON.stringify(refreshed);\n",
      "utf8",
    );
    await session.waitForBuilds(2);
    transcript = session.transcript();
    samples = residentSamples(transcript);
    assert.equal(samples.length, 4, transcript);
    assert.deepEqual(
      samples[2],
      {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 1,
        reused: true,
      },
      transcript,
    );
    assert.deepEqual(
      samples[3],
      {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 2,
        reused: true,
      },
      transcript,
    );
    assert.doesNotMatch(transcript, /invalid request/i);
  } finally {
    await session.close();
  }
}

function residentSamples(transcript: string): ResidentSample[] {
  return [
    ...transcript.matchAll(
      /@ttsc\/lint resident check: pid=(\d+) programLoads=(\d+) programUpdates=(\d+) reused=(true|false)/g,
    ),
  ].map((match) => ({
    pid: Number(match[1]),
    programLoads: Number(match[2]),
    programUpdates: Number(match[3]),
    reused: match[4] === "true",
  }));
}
