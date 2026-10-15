import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

/**
 * Verifies an emitting transform watch retains plugin selection across source
 * edits and reloads it after a project config change.
 *
 * 1. Start a real watch with the workspace paths transform and diagnostics.
 * 2. Edit a source and require new emitted bytes, an unchanged output's old
 *    timestamp, and only one setup phase.
 * 3. Change tsconfig and require a new setup phase after the reload.
 * 4. Run a normal one-shot build with a stale inherited watch opt-in and require
 *    the unchanged file to be written normally.
 *
 * @evidence contracts/testing.md#behavioral-verification The native transform watch emits the edited value while leaving a byte-identical output's authored old timestamp intact, records one plugin setup across two cycles, then records another setup after config replacement. A normal build clears an inherited watch opt-in and rewrites the output.
 * @evidence contracts/testing.md#independent-expectations Authored source literals determine the two output values; an old timestamp and one stable selection followed by one config-triggered reload determine write and setup expectations independently of measured seconds.
 * @evidence contracts/testing.md#distinguishing-cases Source changes preserve selection while a config change invalidates it, and every cycle still performs an emitting native build.
 * @evidence contracts/testing.md#execution-ownership The E2E scenarios batch registers this named export; WatchSession owns one real launcher and joins it before TestProject releases the temporary project.
 * @evidence contracts/e2e.md#necessary-boundary Selection reuse must cross filesystem wakeups, descriptor resolution, and a stock-Go transform host; a local session mock cannot prove those connections.
 * @evidence contracts/e2e.md#shared-execution The runs share one watch child, workspace plugin source, and suite-owned cache; the test asserts selection phase counts, not a cache hit or duration.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked project owns its config, source, output, and plugin junction. The session closes before those inputs are released, and the shared cache is never removed.
 * @evidence contracts/e2e.md#preserved-coverage This new watch case supplements existing source/config invalidation tests without removing their assertions.
 */
export async function test_plugin_corpus_emit_watch_reuses_plugin_selection_until_config_changes(): Promise<void> {
  const root = commonJsProject(
    {
      "src/main.ts": "export const value = 1;\n",
      "src/untouched.ts": "export const untouched = 29;\n",
    },
    { compilerOptions: { plugins: [{ transform: "@ttsc/paths" }] } },
  );
  const scope = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(scope, { recursive: true });
  fs.symlinkSync(
    path.join(workspaceRoot, "packages", "paths"),
    path.join(scope, "paths"),
    "junction",
  );
  const source = path.join(root, "src", "main.ts");
  const output = path.join(root, "dist", "main.js");
  const unchangedOutput = path.join(root, "dist", "untouched.js");
  const session = new WatchSession(root, {
    args: ["--extendedDiagnostics"],
    env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
  });
  try {
    await session.waitForBuilds(1);
    assert.ok(fs.existsSync(output), session.transcript());
    assert.match(fs.readFileSync(output, "utf8"), /value = 1/);
    const oldTime = new Date(Date.UTC(2001, 0, 1));
    fs.utimesSync(unchangedOutput, oldTime, oldTime);
    fs.writeFileSync(source, "export const value = 2;\n", "utf8");
    await session.waitForBuilds(2);
    assert.match(fs.readFileSync(output, "utf8"), /value = 2/);
    assert.equal(fs.statSync(unchangedOutput).mtime.getUTCFullYear(), 2001);
    assert.equal(setupCount(session), 1, session.transcript());

    const tsconfig = path.join(root, "tsconfig.json");
    const project = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
    project.compilerOptions.strict = false;
    fs.writeFileSync(tsconfig, JSON.stringify(project), "utf8");
    await session.waitForBuilds(3);
    assert.equal(setupCount(session), 2, session.transcript());
    assert.match(fs.readFileSync(output, "utf8"), /value = 2/);
  } finally {
    await session.close();
  }

  const oldTime = new Date(Date.UTC(2001, 0, 1));
  fs.utimesSync(unchangedOutput, oldTime, oldTime);
  const ordinary = spawn(ttscBin, ["--cwd", root], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      TTSC_WATCH_WRITE_IF_CHANGED: "1",
    },
  });
  assert.equal(ordinary.status, 0, ordinary.stderr);
  assert.notEqual(fs.statSync(unchangedOutput).mtime.getUTCFullYear(), 2001);
}

/** Count completed selection phases in the public timing transcript. */
function setupCount(session: WatchSession): number {
  return (session.transcript().match(/ttsc plugin setup time:/g) ?? []).length;
}
