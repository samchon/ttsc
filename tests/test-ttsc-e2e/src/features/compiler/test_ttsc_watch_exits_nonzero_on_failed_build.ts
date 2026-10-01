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
 * 3. Assert Linux delivers SIGTERM to the handler and the watcher exits with a numeric non-zero code, rather than being killed by a signal.
 *
 * @evidence contracts/testing.md#behavioral-verification On Linux, spawns ttsc watch on a number-valued export initialized by a string, waits for a failed build marker, sends SIGTERM and asserts TS2322, a normal numeric exit, no termination signal and the existing nonzero status requirement.
 * @evidence contracts/testing.md#independent-expectations The authored assignability error independently requires TS2322 and failed checking; the watcher must propagate that failure through its signal handler as a numeric nonzero exit. Null status or signal termination cannot satisfy this oracle.
 * @evidence contracts/testing.md#distinguishing-cases Owns initially invalid watch build followed by handled termination. Linux runs this portable launcher status contract once; Windows child.kill forcefully terminates the process and cannot exercise the handler, so its null status is not substituted for failure propagation.
 * @evidence contracts/testing.md#execution-ownership E2E export test_ttsc_watch_exits_nonzero_on_failed_build is discovered under src/features/compiler and executes on Linux with the built launcher plus real native compiler. Other hosts return before this Linux signal-handler case; Windows watch shutdown remains covered by the real WatchSession lifecycle cases.
 * @evidence contracts/e2e.md#necessary-boundary Native compile failure must cross a live launcher watch loop into process shutdown status; direct build or status-calculation units cannot verify that connection.
 * @evidence contracts/e2e.md#shared-execution One watch process combines the initial failed compile and shutdown. Built launcher/native compiler overrides are shared with the suite; no plugin binary is produced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A unique project and one terminated flag prevent repeated SIGTERM. The close/error handlers clear the 120-second timer and timeout sends SIGKILL; TestProject owns the root at worker exit. There is no separate finally cleanup path for unexpected callback failure.
 * @evidence contracts/e2e.md#preserved-coverage The failed native build, post-build SIGTERM and existing nonzero assertion remain. Failed-marker/TS2322 and numeric-code/no-signal checks strengthen status propagation; Windows forced-kill behavior is retained in WatchSession shutdown boundaries without pretending it runs this handler.
 */
export const test_ttsc_watch_exits_nonzero_on_failed_build =
  async (): Promise<void> => {
    // Windows child.kill("SIGTERM") terminates the process in the kernel;
    // it does not deliver a signal to Node's registered handler. The portable
    // launcher status contract runs once on Linux in the boundary batch.
    if (process.platform !== "linux") return;
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
        /\[ttsc\] watch build failed/.test(output)
      ) {
        terminated = true;
        child.kill("SIGTERM");
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);

    const { code, signal } = await exit;
    assert.equal(terminated, true, output);
    assert.match(output, /TS2322/);
    assert.equal(signal, null, `the watcher must handle SIGTERM:\n${output}`);
    assert.equal(
      typeof code,
      "number",
      `the watcher must return its build status:\n${output}`,
    );
    assert.notEqual(
      code,
      0,
      `ttsc --watch should exit non-zero after a failed build (code=${code}, signal=${signal})\n${output}`,
    );
  };
