import {
  assert,
  child_process,
  createProject,
  fs,
  nativeBinary,
  path,
  tsgoBinary,
  ttscBin,
} from "../../internal/toolchain";

const VALID_TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "commonjs",
    strict: true,
    noEmit: true,
    rootDir: "src",
  },
  include: ["src"],
});

/**
 * Verifies a watch session names the broken tsconfig and rebuilds after repair.
 *
 * `runWatch` deliberately catches a throwing rebuild so the session survives,
 * which is correct — but what it printed was the bare V8 `JSON.parse` message,
 * once per save, for as long as the file stayed malformed. The watch lane is
 * where the missing attribution hurts most because it repeats, so this pins
 * both halves: the message names the file while broken, and the session still
 * recovers once it is repaired.
 *
 * 1. Spawn the real `ttsc --watch` and wait for the first clean build.
 * 2. Overwrite tsconfig.json with invalid JSON and wait for the failed rebuild.
 * 3. Assert the failure names that tsconfig, then restore it and assert the
 *    session rebuilds cleanly.
 *
 * @evidence contracts/testing.md#behavioral-verification Spawns watch, changes config to invalid JSON after a clean build, observes failure, restores config and edits source; asserts ttsc failed-to-parse voice, exact config path and repaired done phase.
 * @evidence contracts/testing.md#independent-expectations Config errors must identify their file and a live watcher must recover. Authored broken/restored bytes and phase-local transcripts independently distinguish attribution and later recovery.
 * @evidence contracts/testing.md#distinguishing-cases Owns clean/broken/repaired states with exact path attribution. Source edits accompany config writes, so config-only event handling is not isolated.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_names_the_broken_tsconfig_and_recovers_after_repair is discovered under src/features/compiler by TestExecutor; it owns its local child/WatchSession/helper assertions and uses the built launcher with suite-selected real native binaries.
 * @evidence contracts/e2e.md#necessary-boundary The live debounce path must catch config-reader failure and remain responsive to a later valid rebuild. Cold reader calls cannot prove process recovery.
 * @evidence contracts/e2e.md#shared-execution One watch lifetime shares project load/subscriptions across all three phases; built native compiler/launcher are reused and no plugin binary is produced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Phase labels keep earlier banners out of recovery assertions; done sends SIGTERM once. Close/error clear the 180-second timer, timeout kills the child and TestProject owns root cleanup; unexpected callback exceptions have no finally teardown.
 * @evidence contracts/e2e.md#preserved-coverage Both attribution assertions and done recovery remain. Final numeric exit status and config-only invalidation are not asserted.
 */
export const test_ttsc_watch_names_the_broken_tsconfig_and_recovers_after_repair =
  async (): Promise<void> => {
    const root = createProject({
      "tsconfig.json": VALID_TSCONFIG,
      "src/main.ts": `export const value: number = 1;\n`,
    });
    const tsconfig = path.join(root, "tsconfig.json");

    const child = child_process.spawn(
      process.execPath,
      [ttscBin, "--watch", "--cwd", root],
      {
        cwd: root,
        env: {
          ...process.env,
          TTSC_BINARY: nativeBinary,
          TTSC_TSGO_BINARY: tsgoBinary,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    let output = "";
    let phase: "first" | "broken" | "repaired" | "done" = "first";
    let broken = "";
    let repaired = "";
    const exit = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`ttsc --watch did not settle in time:\n${output}`));
      }, 180_000);
      child.on("close", () => {
        clearTimeout(timer);
        resolve();
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const onChunk = (chunk: Buffer): void => {
      const text = chunk.toString("utf8");
      output += text;
      if (phase === "broken") broken += text;
      if (phase === "repaired") repaired += text;
      if (phase === "first" && /\[ttsc\] watch build complete/.test(output)) {
        phase = "broken";
        fs.writeFileSync(tsconfig, "{ this is not valid json", "utf8");
        fs.writeFileSync(
          path.join(root, "src/main.ts"),
          `export const value: number = 2;\n`,
          "utf8",
        );
        return;
      }
      if (phase === "broken" && /\[ttsc\] watch build failed/.test(broken)) {
        phase = "repaired";
        fs.writeFileSync(tsconfig, VALID_TSCONFIG, "utf8");
        fs.writeFileSync(
          path.join(root, "src/main.ts"),
          `export const value: number = 3;\n`,
          "utf8",
        );
        return;
      }
      if (
        phase === "repaired" &&
        /\[ttsc\] watch build complete/.test(repaired)
      ) {
        phase = "done";
        child.kill("SIGTERM");
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    await exit;

    assert.equal(
      broken.includes("ttsc: failed to parse"),
      true,
      `the watch failure must speak in ttsc's voice:\n${output}`,
    );
    assert.equal(
      broken.includes(tsconfig),
      true,
      `the watch failure must name ${tsconfig}:\n${output}`,
    );
    assert.equal(
      phase,
      "done",
      `the watcher must rebuild cleanly after the config is repaired:\n${output}`,
    );
  };
