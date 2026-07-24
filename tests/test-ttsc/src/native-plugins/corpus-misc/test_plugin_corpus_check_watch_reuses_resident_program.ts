import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";
import { WatchSession } from "../../internal/watch";

type ResidentSample = {
  pid: number;
  programLoads: number;
  programUpdates: number;
  reused: boolean;
};

/**
 * Verifies real `ttsc --noEmit --watch` reuses the lint sidecar and Program
 * only across compatible source edits.
 *
 * The diagnostics stream is ordinary product telemetry. It proves the child PID
 * and Program load count remain stable while updates advance, then proves a
 * root-set transition selects a fresh Program. A cold check of the edited
 * filesystem remains the correctness oracle rather than a fixture-specific
 * expected answer.
 *
 * 1. Start a failing no-var watch and record its first resident sample.
 * 2. Repair the known source, require one incremental sample, and compare the
 *    clean state with a cold one-shot check.
 * 3. Reintroduce the finding and require the same PID/load with another update.
 * 4. Edit tsconfig and require a fresh sidecar.
 * 5. Add and remove a TypeScript root, requiring a full reload each time.
 * 6. Shut down and prove the final resident sidecar was disposed.
 */
export const test_plugin_corpus_check_watch_reuses_resident_program =
  async (): Promise<void> => {
    const root = setupLintProject("lint-violations");
    const source = path.join(root, "src", "main.ts");
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({ rules: { "no-var": "error" } }),
    );
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
      let samples = residentSamples(session.transcript());
      assert.equal(samples.length, 1, session.transcript());
      assert.deepEqual(samples[0], {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 0,
        reused: false,
      });

      fs.writeFileSync(
        source,
        "const modern = 1;\nJSON.stringify(modern);\n",
        "utf8",
      );
      await session.waitForBuilds(2);
      samples = residentSamples(session.transcript());
      assert.equal(samples.length, 2, session.transcript());
      assert.deepEqual(samples[1], {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 1,
        reused: true,
      });
      fs.writeFileSync(
        source,
        "var legacy = 1;\nJSON.stringify(legacy);\n",
        "utf8",
      );
      await session.waitForBuilds(3);
      samples = residentSamples(session.transcript());
      assert.equal(samples.length, 3, session.transcript());
      assert.deepEqual(samples[2], {
        pid: samples[0]!.pid,
        programLoads: 1,
        programUpdates: 2,
        reused: true,
      });

      const tsconfig = path.join(root, "tsconfig.json");
      const config = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
        compilerOptions: Record<string, unknown>;
      };
      config.compilerOptions.noUnusedLocals = false;
      fs.writeFileSync(tsconfig, JSON.stringify(config), "utf8");
      await session.waitForBuilds(4);
      samples = residentSamples(session.transcript());
      assert.equal(samples.length, 4, session.transcript());
      assertFreshSample(samples[3]!, samples[2]!.pid);

      const added = path.join(root, "src", "added.ts");
      fs.writeFileSync(added, "export const added = true;\n", "utf8");
      await session.waitForBuilds(5);
      samples = residentSamples(session.transcript());
      assert.equal(samples.length, 5, session.transcript());
      assertFreshSample(samples[4]!, samples[3]!.pid);

      fs.rmSync(added);
      await session.waitForBuilds(6);
      samples = residentSamples(session.transcript());
      assert.equal(samples.length, 6, session.transcript());
      assertFreshSample(samples[5]!, samples[4]!.pid);
    } finally {
      await session.close();
    }
    const finalPid = residentSamples(session.transcript()).at(-1)?.pid;
    assert.notEqual(finalPid, undefined, session.transcript());
    await waitForProcessExit(finalPid!);
    fs.writeFileSync(
      source,
      "const modern = 1;\nJSON.stringify(modern);\n",
      "utf8",
    );
    const cold = spawn(ttscBin, ["--noEmit", "--cwd", root], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.equal(cold.status, 0, cold.stderr);
  };

function assertFreshSample(sample: ResidentSample, previousPid: number): void {
  assert.notEqual(sample.pid, previousPid);
  assert.equal(sample.programLoads, 1);
  assert.equal(sample.programUpdates, 0);
  assert.equal(sample.reused, false);
}

async function waitForProcessExit(pid: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (processIsAlive(pid)) {
    if (Date.now() >= deadline) {
      assert.fail(`resident check sidecar ${String(pid)} survived watch close`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
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
