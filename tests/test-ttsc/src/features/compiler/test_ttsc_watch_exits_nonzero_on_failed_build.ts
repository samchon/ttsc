import {
  assert,
  child_process,
  createProject,
  nativeBinary,
  ttscBin,
  tsgoBinary,
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
 * 2. Spawn the real `ttsc --watch` launcher and wait for one build pass to
 *    report failure, then terminate the watcher with SIGTERM.
 * 3. Assert the watch process exits with a non-zero code.
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
      if (!terminated && /\[ttsc\] watch build (?:failed|complete)/.test(output)) {
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
