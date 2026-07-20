import {
  assert,
  child_process,
  createProject,
  nativeBinary,
  tsgoBinary,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a mixed-case `--Watch` enters ttsc's own plugin-aware watch loop.
 *
 * This row cannot be proven by a one-shot build. tsgo also implements
 * `--watch`, so an unrecognised case variant did not fail — it was forwarded,
 * tsgo took over the session with its own watch loop, and ttsc's plugin-aware
 * watch never ran, so no plugin transform applied on any rebuild. The
 * observable difference is which loop owns the session, so the case must drive
 * the real launcher and read the banner it prints.
 *
 * 1. Materialize a project and spawn the real `ttsc --Watch`.
 * 2. Wait for a line that only ttsc's watch loop prints (`[ttsc] watching …`).
 * 3. Assert that line appeared, tsgo's own watch banner did not, and terminate the
 *    session.
 */
export const test_ttsc_watch_flag_in_mixed_case_enters_the_ttsc_watch_loop =
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
      "src/main.ts": `export const value: number = 1;\n`,
    });

    const child = child_process.spawn(
      process.execPath,
      [ttscBin, "--Watch", "--cwd", root],
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
    let terminated = false;
    const exit = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`ttsc --Watch did not settle in time:\n${output}`));
      }, 120_000);
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
      output += chunk.toString("utf8");
      if (
        !terminated &&
        /\[ttsc\] watch build (complete|failed)/.test(output)
      ) {
        terminated = true;
        child.kill("SIGTERM");
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    await exit;

    assert.match(output, /\[ttsc\] watching /);
    // tsgo's own watch loop announces itself with a timestamped
    // "Starting compilation in watch mode..." line; ttsc's never does.
    assert.equal(
      /Starting compilation in watch mode/.test(output),
      false,
      `the session must be ttsc's watch loop, not tsgo's:\n${output}`,
    );
  };
