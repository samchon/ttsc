import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Verifies public asynchronous transforms preserve inherited Node options.
 *
 * With a preload, stdin-only input type reaches a file worker's initial module resolution and rejects before its API request. Worker bootstrap must retain both preload hooks and Node's handling of otherwise unsupported execArgv.
 *
 * 1. Reuse the runtime batch's compiler cache for one private minimal project.
 * 2. Evaluate one real consumer with input type, preload, heap and title options.
 * 3. Require transformed output, the real config failure and worker preload
 *    receipts.
 *
 * @evidence contracts/testing.md#behavioral-verification A real Node eval consumer calls public TtscCompiler.transformAsync for valid and missing configurations; exact marker and missing-config assertions distinguish successful worker execution from startup rejection. Worker-side preload receipts retain the actual inherited option array.
 * @evidence contracts/testing.md#independent-expectations Static source supplies worker-module-ok and the authored absent config supplies its exact diagnostic path. Literal CLI options are independently supplied to Node and must appear in actual worker preload receipts, without copying a bootstrap representation into the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Covers valid no-plugin transformation and genuine config failure under simultaneous --input-type, --import, --max-old-space-size and --title. Portable units own native CommonJS filename resolution, relative imports, source stacks and absent module entries; resident and topology acceptance own their lifetime protocols.
 * @evidence contracts/testing.md#execution-ownership The runtime batch explicitly invokes this scene through the E2E entry; one child Node consumer loads the built public API and starts its actual transform worker and native compiler host. This real inherited-option boundary is outside portable module-loading units.
 * @evidence contracts/e2e.md#necessary-boundary Node applies inherited startup flags before the production entry runs, so direct URL construction or in-process import cannot prove worker startup, preload delivery or the public transform result.
 * @evidence contracts/e2e.md#shared-execution Both API requests share one private project, one evaluated consumer and the runtime batch's existing compiler cache; the first request is valid and the second changes only explicit config selection. Native artifact reuse remains subject to the production cache's actual source/toolchain proof; no installation or separate Go source producer is added.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Static files are copied into one tracked private root, and test environment inputs are passed to the child without replacing ambient state. Both API requests settle before the child exits and its synchronous spawn joins; finally removes the private files. This proves the direct consumer's returned work and retirement, not arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Adds the preload-plus-input-type startup regression and valid/failure controls without moving or deleting existing compiler, runtime or worker lifetime coverage.
 */
export function case_worker_modules_preserve_inherited_node_execution_options(inputs: {
  cacheDir: string;
}): void {
  const root = TestProject.tmpdir("ttsc-worker-module-options-");
  const fixtures = path.join(
    TestProject.WORKSPACE_ROOT,
    "tests/test-e2e/fixtures/ttsc/worker-module-options",
  );
  const log = path.join(root, "worker-preload.jsonl");
  const preload = pathToFileURL(path.join(root, "preload.mjs")).href;
  const title = "--title=ttsc-worker-module-options";
  const heap = "--max-old-space-size=512";
  const inputType = "--input-type=module";
  try {
    TestProject.copyDirectory(fixtures, root);
    const result = TestProject.spawn(
      process.execPath,
      [
        heap,
        title,
        "--import",
        preload,
        inputType,
        "--eval",
        fs.readFileSync(path.join(root, "consumer.mjs"), "utf8"),
      ],
      {
        cwd: root,
        env: {
          TTSC_WORKER_PACKAGE_ENTRY: pathToFileURL(
            path.join(TestProject.WORKSPACE_ROOT, "packages/ttsc/lib/index.js"),
          ).href,
          TTSC_WORKER_CACHE_DIR: inputs.cacheDir,
          TTSC_WORKER_PRELOAD_LOG: log,
        },
      },
    );
    assert.equal(result.error, undefined, result.stderr);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      success: "success",
      failure: "exception",
    });
    const receipts = fs
      .readFileSync(log, "utf8")
      .trim()
      .split(/\r?\n/)
      .map(
        (line) => JSON.parse(line) as { threadId: number; execArgv: string[] },
      );
    assert.ok(
      receipts.length > 0,
      "a worker must execute the inherited preload",
    );
    for (const receipt of receipts) {
      assert.ok(receipt.threadId > 0);
      for (const option of [heap, title, inputType, "--import", preload]) {
        assert.ok(
          receipt.execArgv.includes(option),
          `worker lost inherited option ${option}`,
        );
      }
    }
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}
