import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

/**
 * Verifies a plugin-free check watch keeps upstream incremental state private
 * to its own session, takes membership from its own compiler run, and that two
 * watches over the same sources never share that state (#1865, #1866).
 *
 * 1. Start two `ttsc --noEmit --watch` sessions on one plugin-free project whose
 *    source has a type error.
 * 2. Fix the error, then reintroduce it, waiting for both sessions each time.
 * 3. Require each session's own build-info directory outside the project, no
 *    listing after startup, and the error reported again as a cold `ttsc
 *    --noEmit` reports it.
 * 4. Close both and require both directories gone and nothing new in the project.
 *
 * @evidence contracts/testing.md#behavioral-verification Two real watches must each name a distinct existing private directory holding upstream build info outside the project, start no listing per cycle, report the reintroduced error identically to a cold check, and remove the directories on close; a shared, leaked or project-local state, a per-cycle listing or a changed diagnostic each fails an assertion.
 * @evidence contracts/testing.md#independent-expectations The expected diagnostic is the cold one-shot compiler's own line for the same source, and the expected project contents are the files the test wrote; startup lists at most twice (initial refresh plus its post-registration membership check).
 * @evidence contracts/testing.md#distinguishing-cases Owns the plugin-free analysis lane with concurrent sessions, a failing, passing and failing-again sequence; test_plugin_corpus_check_watch_keeps_resident_checks_beside_a_transform_plugin owns the plugin lanes.
 * @evidence contracts/testing.md#execution-ownership The E2E scenarios batch registers this named export; both WatchSessions are joined before the final assertions.
 * @evidence contracts/e2e.md#necessary-boundary Incremental state, membership reporting and temporary-directory ownership cross the real launcher, the installed tsgo and the topology worker; a unit cannot show two processes keeping separate state.
 * @evidence contracts/e2e.md#shared-execution Two sessions share one temporary project for the concurrency case and one cold control run; no plugin cache is involved.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The temporary project belongs to this test; each session's state directory is asserted removed after close.
 * @evidence contracts/e2e.md#preserved-coverage A new case; no existing assertion changes.
 */
export async function test_ttsc_watch_plugin_free_check_keeps_private_incremental_state(): Promise<void> {
  const failing = "export const value: number = 'text';\n";
  const root = commonJsProject(
    { "src/main.ts": failing, "src/other.ts": "export const other = 1;\n" },
    { compilerOptions: { noEmit: true } },
  );
  const source = path.join(root, "src", "main.ts");
  const before = listProject(root);
  const sessions = [0, 1].map(
    () =>
      new WatchSession(root, {
        args: ["--noEmit"],
        env: { TTSC_WATCH_DEBUG_INPUTS: "1" },
      }),
  );
  const directories: string[] = [];
  try {
    await Promise.all(sessions.map((session) => session.waitForBuilds(1)));
    fs.writeFileSync(source, "export const value: number = 1;\n");
    await Promise.all(sessions.map((session) => session.waitForBuilds(2)));
    for (const session of sessions) {
      const match = /\[ttsc:debug\] incremental check state (".*")/.exec(
        session.transcript(),
      );
      assert.ok(match, session.transcript());
      const directory = JSON.parse(match[1]!) as string;
      directories.push(directory);
      assert.ok(
        fs.existsSync(path.join(directory, "check.tsbuildinfo")),
        session.transcript(),
      );
      assert.ok(
        path.relative(root, directory).startsWith(".."),
        `${directory} lies inside the project`,
      );
    }
    assert.notEqual(directories[0], directories[1]);
    fs.writeFileSync(source, failing);
    await Promise.all(sessions.map((session) => session.waitForBuilds(3)));
    await Promise.all(sessions.map((session) => session.waitForIdle()));
  } finally {
    await Promise.all(sessions.map((session) => session.close()));
  }
  const cold = spawn(ttscBin, ["--noEmit", "--cwd", root], { cwd: root });
  assert.ifError(cold.error);
  const expected = `${cold.stdout}\n${cold.stderr}`
    .split(/\r?\n/)
    .find((line) => line.includes("TS2322"));
  assert.ok(expected, `${cold.stdout}\n${cold.stderr}`);
  for (const session of sessions) {
    const transcript = session.transcript();
    const lastCycle = transcript.slice(
      transcript.lastIndexOf("[ttsc] rebuilding at"),
    );
    assert.ok(lastCycle.includes(expected!.trim()), transcript);
    const listings = (
      transcript.match(/\[ttsc:debug\] compiler listing /g) ?? []
    ).length;
    assert.ok(listings >= 1 && listings <= 2, transcript);
  }
  for (const directory of directories)
    assert.equal(fs.existsSync(directory), false, directory);
  assert.deepEqual(listProject(root), before);
}

/** Every path below the project, so a stray state file shows up. */
function listProject(root: string): string[] {
  return (fs.readdirSync(root, { recursive: true }) as string[])
    .filter((entry) => !entry.split(path.sep).includes("node_modules"))
    .sort();
}
