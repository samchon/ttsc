import {
  assert,
  child_process,
  createProject,
  nativeBinary,
  tsgoBinary,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc --watch` exits non-zero when its most recent build failed.
 *
 * The watch loop reports each rebuild's status to the terminal but historically
 * returned a hardcoded 0 and exited 0 on SIGINT/SIGTERM, so CI tasks or scripts
 * that gate on the watch session's exit code never saw a type error. This pins
 * the launcher propagating the latest build status into the process exit code.
 *
 * 1. Materialize a project whose single source file has a type error.
 * 2. Spawn the real `ttsc --watch` launcher and wait for one build pass to report
 *    failure, then terminate the watcher with SIGTERM.
 * 3. Assert the watch process exits with a non-zero code.
 *
 * @evidence contracts/testing.md#behavioral-verification Spawns ttsc watch on a number-valued export initialized by a string, waits for a complete/failed build banner, sends SIGTERM and asserts the observed exit code differs from zero.
 * @evidence contracts/testing.md#independent-expectations The latest failed build must govern watch-session shutdown status. The authored assignability error establishes failure independently; code not-equal-zero also accepts null from signal termination, so it does not distinguish a propagated numeric failure from forced termination.
 * @evidence contracts/testing.md#distinguishing-cases Owns initially invalid watch build followed by termination. It has no successful-session or failure-then-repair status counterpart and does not assert the diagnostic text.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_exits_nonzero_on_failed_build is discovered under src/features/compiler; it owns its child/WatchSession assertions and uses the built launcher plus suite-selected real native compiler, without dynamic case registration.
 * @evidence contracts/e2e.md#necessary-boundary Native compile failure must cross a live launcher watch loop into process shutdown status; direct build or status-calculation units cannot verify that connection.
 * @evidence contracts/e2e.md#shared-execution One watch process combines the initial failed compile and shutdown. Built launcher/native compiler overrides are shared with the suite; no plugin binary is produced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A unique project and one terminated flag prevent repeated SIGTERM. The close/error handlers clear the 120-second timer and timeout sends SIGKILL; TestProject owns the root at worker exit. There is no separate finally cleanup path for unexpected callback failure.
 * @evidence contracts/e2e.md#preserved-coverage The existing post-build termination and nonzero-code assertion remain intact. The signal-null ambiguity is disclosed rather than treating any killed watcher as proof of numeric status propagation.
 */
export const test_ttsc_watch_exits_nonzero_on_failed_build =
  async (): Promise<void> => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          noEmit: true,
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `export const value: number = "not a number";\n`,
    });

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

    const exit = new Promise<{ code: number | null; signal: string | null }>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`ttsc --watch did not exit in time:\n${output}`));
        }, 120_000);
        child.on("close", (code, signal) => {
          clearTimeout(timer);
          resolve({ code, signal });
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
      },
    );

    let output = "";
    let terminated = false;
    const onChunk = (chunk: Buffer): void => {
      output += chunk.toString("utf8");
      // Wait for a full build pass to land before tearing the watcher down, so
      // the exit code reflects an evaluated (failed) build rather than startup.
      if (
        !terminated &&
        /\[ttsc\] watch build (?:failed|complete)/.test(output)
      ) {
        terminated = true;
        child.kill("SIGTERM");
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);

    const { code, signal } = await exit;
    assert.notEqual(
      code,
      0,
      `ttsc --watch should exit non-zero after a failed build (code=${code}, signal=${signal})\n${output}`,
    );
  };
