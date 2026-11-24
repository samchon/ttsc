import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

/**
 * Verifies a no-emit watch over a check plugin and a transform plugin keeps
 * both hosts resident and repeats no whole-Program work per save.
 *
 * Before #1864 one transform-stage plugin sent every cycle to the one-shot
 * build, so `@ttsc/lint` started cold each save. Before #1865 every cycle was
 * followed by a separate compiler listing, and before #1869 a failing resident
 * cycle ran a cold recovery check on top of the resident reply.
 *
 * 1. Start `ttsc --noEmit --watch --diagnostics` with debug reporting on a lint
 *    project that also selects the `@ttsc/paths` transform, from clean source.
 * 2. Save a clean edit, then introduce a `no-var` finding.
 * 3. Require one stable resident lint process with one update per save, one stable
 *    resident transform host on the two passing cycles, no listing after
 *    startup and no recovery check, and the finding in the last cycle.
 * 4. Close the watch, then require `ttsc --no-plugins --noEmit` to pass the same
 *    failing source through the plain compiler (#1867).
 *
 * @evidence contracts/testing.md#behavioral-verification A real watch must print resident lint and transform-host telemetry with stable PIDs and growing update counts, at most the startup listings, no recovery check and the reintroduced finding; each earlier defect breaks one of those assertions (no telemetry, a listing per cycle, a recovery line). The final one-shot must pass without lint.
 * @evidence contracts/testing.md#independent-expectations Literal load/update/reuse tables follow the check-serve protocol (one load, one update per compatible edit); a transform host runs only after passing checks, as in a one-shot build; startup lists at most twice (the initial refresh and its post-registration membership check), and no cycle may list.
 * @evidence contracts/testing.md#distinguishing-cases Owns the mixed check-plus-transform analysis selection, a passing and a failing resident cycle, and the plain-compiler `--no-plugins` control; test_plugin_corpus_check_watch_reuses_resident_program owns config and root transitions of a check-only selection, and test_ttsc_watch_plugin_free_check_keeps_private_incremental_state owns the plugin-free lane.
 * @evidence contracts/testing.md#execution-ownership The E2E scenarios batch registers this named export; WatchSession owns one real launcher and joins it before the one-shot control runs.
 * @evidence contracts/e2e.md#necessary-boundary Residency beside a transform needs filesystem wakeups, descriptor resolution, the real lint check-serve sidecar, the linked utility host and the watch topology worker; unit fakes cannot show them sharing one cycle.
 * @evidence contracts/e2e.md#shared-execution Three cycles share one watch child, workspace plugin sources and the suite-owned cache; the test asserts telemetry and debug reports, not cache hits or durations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The copied fixture owns its config, source and plugin links; the session closes before the control run, and the shared cache is never removed.
 * @evidence contracts/e2e.md#preserved-coverage A new case beside the existing resident-watch cases; none of their assertions change.
 */
export async function test_plugin_corpus_check_watch_keeps_resident_checks_beside_a_transform_plugin(): Promise<void> {
  const root = setupLintProject("lint-violations");
  fs.symlinkSync(
    path.join(workspaceRoot, "packages", "paths"),
    path.join(root, "node_modules", "@ttsc", "paths"),
    "junction",
  );
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
    compilerOptions: { plugins: unknown[] };
  };
  config.compilerOptions.plugins.push({ transform: "@ttsc/paths" });
  fs.writeFileSync(tsconfig, JSON.stringify(config), "utf8");
  fs.writeFileSync(
    path.join(root, "lint.config.json"),
    JSON.stringify({ rules: { "no-var": "error" } }),
  );
  const source = path.join(root, "src", "main.ts");
  fs.writeFileSync(source, "const modern = 1;\nJSON.stringify(modern);\n");
  const env = {
    PATH: goPath(),
    TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
  };
  const session = new WatchSession(root, {
    args: ["--noEmit", "--diagnostics"],
    env: { ...env, TTSC_WATCH_DEBUG_INPUTS: "1" },
  });
  try {
    await session.waitForBuilds(1);
    fs.writeFileSync(source, "const later = 2;\nJSON.stringify(later);\n");
    await session.waitForBuilds(2);
    fs.writeFileSync(source, "var legacy = 1;\nJSON.stringify(legacy);\n");
    await session.waitForBuilds(3);
    await session.waitForIdle();
  } finally {
    await session.close();
  }
  const transcript = session.transcript();
  const lint = residentReplies(transcript, "@ttsc/lint");
  const pid = lint[0]?.pid;
  assert.deepEqual(
    lint,
    [
      { pid, programLoads: 1, programUpdates: 0, reused: false },
      { pid, programLoads: 1, programUpdates: 1, reused: true },
      { pid, programLoads: 1, programUpdates: 2, reused: true },
    ],
    transcript,
  );
  const transform = residentReplies(transcript, "@ttsc/paths");
  const host = transform[0]?.pid;
  assert.deepEqual(
    transform,
    [
      { pid: host, programLoads: 1, programUpdates: 0, reused: false },
      { pid: host, programLoads: 1, programUpdates: 1, reused: true },
    ],
    transcript,
  );
  assert.notEqual(host, pid, transcript);
  const listings = (transcript.match(/\[ttsc:debug\] compiler listing /g) ?? [])
    .length;
  assert.ok(listings >= 1 && listings <= 2, transcript);
  assert.doesNotMatch(transcript, /\[ttsc:debug\] recovery check/, transcript);
  const lastCycle = transcript.slice(
    transcript.lastIndexOf("[ttsc] rebuilding at"),
  );
  assert.match(lastCycle, /no-var/, transcript);

  const plain = spawn(ttscBin, ["--no-plugins", "--noEmit", "--cwd", root], {
    cwd: root,
    env,
  });
  assert.ifError(plain.error);
  assert.equal(plain.status, 0, `${plain.stdout}\n${plain.stderr}`);
  assert.doesNotMatch(`${plain.stdout}\n${plain.stderr}`, /no-var/);
}

/** The debug-reported resident replies of one plugin, in cycle order. */
function residentReplies(transcript: string, plugin: string) {
  return transcript
    .split(/\r?\n/)
    .filter((line) => line.startsWith("[ttsc:debug] resident reply "))
    .map(
      (line) =>
        JSON.parse(line.slice("[ttsc:debug] resident reply ".length)) as {
          plugin?: string;
          pid: number;
          programLoads: number;
          programUpdates: number;
          reused: boolean;
        },
    )
    .filter((reply) => reply.plugin === plugin)
    .map(({ pid, programLoads, programUpdates, reused }) => ({
      pid,
      programLoads,
      programUpdates,
      reused,
    }));
}
