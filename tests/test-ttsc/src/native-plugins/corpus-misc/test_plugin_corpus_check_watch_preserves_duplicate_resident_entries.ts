import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
} from "../../internal/plugin-corpus";
import { WatchSession } from "../../internal/watch";

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
 */
export const test_plugin_corpus_check_watch_preserves_duplicate_resident_entries =
  async (): Promise<void> => {
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
      assert.deepEqual(samples[0], {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 0,
        reused: false,
      });
      assert.deepEqual(samples[1], {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 0,
        reused: true,
      });
      assert.equal(noVarDiagnosticCount(transcript), 2, transcript);
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
      assert.deepEqual(samples[2], {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 1,
        reused: true,
      });
      assert.deepEqual(samples[3], {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 2,
        reused: true,
      });
      assert.equal(noVarDiagnosticCount(transcript), 4, transcript);
      assert.doesNotMatch(transcript, /invalid request/i);
    } finally {
      await session.close();
    }
  };

function noVarDiagnosticCount(transcript: string): number {
  return transcript.match(/\[no-var\]/g)?.length ?? 0;
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
