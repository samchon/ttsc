import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  commonJsProject,
  fs,
  path,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";
import {
  child_process,
  nativeBinary,
  tsgoBinary,
} from "../../../internal/ttsc/internal/toolchain";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Starts real positional watch for noEmit and check, waits for initial completion, edits value 1 to 2, checks no output after each completion, sends SIGTERM and asserts a rebuild occurred with no final output.
 * @evidence contracts/testing.md#independent-expectations Analysis-only mode must survive watch redispatch as well as the initial build. Independently authored source mutation and two completion witnesses distinguish a real rebuild from idle success; no diagnostic-content oracle is asserted.
 * @evidence contracts/testing.md#distinguishing-cases Owns both documented watch forms and their initial/edit/rebuild/stop transitions. One-shot spellings remain in the positional forms entry; invalid watch recovery is outside this case.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_single_file_noemit_watch_rebuilds_without_writes is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The real watch host must connect source filesystem changes to a second native compile without final output writes; direct dispatcher tests cannot establish watcher/process lifecycle.
 * @evidence contracts/e2e.md#shared-execution One watch child per distinct command form batches initial build and source-triggered rebuild. Both use shared built launcher/native binaries; fresh projects separate form-specific state rather than rebuilding those producers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique projects and output paths separate sessions; mutated/stopped flags gate one edit and one stop. Child close/error clears the 120-second timer and timeout kills the child; data-callback assertion failures lack a finally cleanup path and can escape the awaited promise, an existing limitation.
 * @evidence contracts/e2e.md#preserved-coverage Both forms retain initial/rebuild/final absence and stopped/rebuild assertions in watchWithoutWriting. The loop can skip the second form after the first fails, and cancellation cleanup is not claimed stronger than the existing helper.
 */
export const test_compiler_corpus_single_file_noemit_watch_rebuilds_without_writes =
  async (): Promise<void> => {
    for (const argv of [
      ["--noEmit", "--watch"],
      ["check", "--watch"],
    ]) {
      const root = commonJsProject(FixtureFiles.read("ttsc/compiler_corpus_single_file_noemit_watch_rebuilds_without_writes/inputs-1"));
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
    [ttscBin, ...mode, "--preserveWatchOutput", "--cwd", root, "src/main.ts"],
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
