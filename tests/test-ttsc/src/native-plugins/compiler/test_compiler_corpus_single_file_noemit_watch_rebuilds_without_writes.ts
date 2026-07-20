import {
  assert,
  child_process,
  commonJsProject,
  fs,
  nativeBinary,
  path,
  tsgoBinary,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies compiler corpus: single-file no-emit watch rebuilds without writes.
 *
 * `runWatch` owns a second single-file dispatch, so a correct one-shot path is
 * insufficient. Both documented analysis-only watch forms must stay write-free
 * for the initial build and a real source-triggered rebuild.
 *
 * 1. Start each real watch form against a normally emitting single-file project.
 * 2. Wait for its initial build, verify no output, then modify the source.
 * 3. Verify the rebuilt session still wrote nothing and exits on SIGTERM.
 */
export const test_compiler_corpus_single_file_noemit_watch_rebuilds_without_writes =
  async (): Promise<void> => {
    for (const argv of [
      ["--noEmit", "--watch"],
      ["check", "--watch"],
    ]) {
      const root = commonJsProject({
        "src/main.ts": `export const value: number = 1;\n`,
      });
      await watchWithoutWriting(root, argv);
    }
  };

async function watchWithoutWriting(
  root: string,
  mode: readonly string[],
): Promise<void> {
  const output = path.join(root, "dist", "main.js");
  const child = child_process.spawn(
    process.execPath,
    [
      ttscBin,
      ...mode,
      "--preserveWatchOutput",
      "--cwd",
      root,
      "src/main.ts",
    ],
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

  let transcript = "";
  let mutated = false;
  let stopped = false;
  const exit = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`single-file watch did not settle:\n${transcript}`));
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
    transcript += chunk.toString("utf8");
    const completed =
      transcript.match(/\[ttsc\] watch build complete/g)?.length ?? 0;
    if (!mutated && completed >= 1) {
      assert.equal(fs.existsSync(output), false, `${mode[0]} wrote ${output}`);
      mutated = true;
      fs.writeFileSync(
        path.join(root, "src", "main.ts"),
        `export const value: number = 2;\n`,
        "utf8",
      );
      return;
    }
    if (mutated && !stopped && completed >= 2) {
      assert.equal(
        fs.existsSync(output),
        false,
        `${mode[0]} wrote ${output} after rebuilding`,
      );
      stopped = true;
      child.kill("SIGTERM");
    }
  };
  child.stdout.on("data", onChunk);
  child.stderr.on("data", onChunk);
  await exit;

  assert.equal(stopped, true, `watch did not rebuild:\n${transcript}`);
  assert.equal(fs.existsSync(output), false, `${mode[0]} wrote ${output}`);
}
