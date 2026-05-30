import {
  assert,
  child_process,
  createProject,
  fs,
  nativeBinary,
  path,
  ttscBin,
  tsgoBinary,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc --watch` survives a rebuild whose config load throws.
 *
 * The debounced rebuild fires from `setTimeout(runOnce, …)`, outside
 * `runTtsc`'s top-level try/catch. A throw there (here: tsconfig mutated to
 * invalid JSON, which makes `readProjectConfig` throw a `SyntaxError` inside
 * `runBuild`) was previously uncaught and crashed the watcher process. This
 * pins the `runOnce` try/finally fix: a throwing rebuild is reported as a
 * failed build and the watcher keeps running, then terminates cleanly on
 * SIGTERM.
 *
 * 1. Materialize a project that builds cleanly, spawn the real `ttsc --watch`,
 *    and wait for the first build pass to complete.
 * 2. Overwrite tsconfig.json with invalid JSON and touch a source file so the
 *    watcher debounces a rebuild whose config load throws.
 * 3. Assert the watcher reports a failed build (did not crash), then SIGTERM
 *    it and assert it exits on signal rather than dying on an uncaught throw.
 */
export const test_ttsc_watch_survives_throwing_rebuild =
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
    let mutated = false;
    let afterMutation = "";
    let terminated = false;
    const onChunk = (chunk: Buffer): void => {
      const text = chunk.toString("utf8");
      output += text;
      if (mutated) afterMutation += text;
      // First clean build landed: break the tsconfig and poke a source file so
      // the next debounced rebuild loads invalid JSON and throws mid-build.
      if (!mutated && /\[ttsc\] watch build complete/.test(output)) {
        mutated = true;
        fs.writeFileSync(
          path.join(root, "tsconfig.json"),
          "{ this is not valid json",
          "utf8",
        );
        fs.writeFileSync(
          path.join(root, "src/main.ts"),
          `export const value: number = 2;\n`,
          "utf8",
        );
        return;
      }
      // The throwing rebuild (invalid JSON parsed during readProjectConfig)
      // must be caught and reported as a failed build, not surface as an
      // uncaught exception that crashes the watcher. Seeing "watch build
      // failed" AFTER the mutation proves the throw was swallowed and the
      // session stayed alive; then SIGTERM it to confirm it terminates cleanly.
      if (mutated && !terminated && /watch build failed/.test(afterMutation)) {
        terminated = true;
        child.kill("SIGTERM");
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);

    const { code, signal } = await exit;
    // A caught throw is reported as a failed build; a pre-fix uncaught throw
    // would print a Node stack trace ("at ... runOnce") with no such line.
    assert.equal(
      terminated,
      true,
      `ttsc --watch should report the throwing rebuild as a failed build without crashing (code=${code}, signal=${signal})\n${output}`,
    );
    // SIGTERM is handled by calling process.exit(latestStatus), so the child
    // reports a normal non-zero exit (code 2), not signal=SIGTERM. Either a
    // signalled or a clean non-zero exit proves the watcher responded to the
    // terminate request rather than dying on the throw.
    assert.equal(
      code === null ? signal !== null : code !== 0,
      true,
      `ttsc --watch should terminate cleanly after a throwing rebuild (code=${code}, signal=${signal})\n${output}`,
    );
    assert.equal(
      /at .*runOnce|Uncaught|UnhandledPromiseRejection/.test(output),
      false,
      `ttsc --watch must not surface the rebuild throw as an uncaught exception\n${output}`,
    );
  };
