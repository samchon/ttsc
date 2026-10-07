import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Preserves two-process exclusion at the actual runtime-directory lock owner.
 *
 * Workers load authored production TypeScript through the existing unit loader.
 * They call only withRuntimeDirectoryLock, not claim/clean CLIs or an installed
 * host. The 300ms non-entry witness is bounded and does not prove exclusion at
 * every possible scheduling interval; later entry distinguishes permanent
 * wait.
 *
 * @evidence contracts/testing.md#behavioral-verification Two native Node workers require the actual withRuntimeDirectoryLock module and contend over one runtime path. Retains ready/attempting/release/entered filenames and literal bytes, the 300ms entered-absent observation, finally release and allSettled collection, both zero exits and eventual entered existence.
 * @evidence contracts/testing.md#independent-expectations Authored barrier files establish holder acquisition, contender attempt and release independently of lock decoding. Literal marker bytes, negative/positive existence and native process outcomes supply expectations; no script substitutes for the lock implementation.
 * @evidence contracts/testing.md#distinguishing-cases A held interval must prevent contender entry, while release must permit eventual entry and successful worker termination. Dead-predecessor recovery and real claim/clean transport are not exercised; the separate in-process claim-before-clean unit owns its own decision observations.
 * @evidence contracts/testing.md#execution-ownership This async source unit owns two actual Node process roles and loads the production source through config/register-unit-loader.mjs, with no guessed built path, install, native compiler, foreign replacement or synthetic PID. Generated CJS is private worker input, not a registered testcase. Finally releases the barrier and settles every acquired worker before root cleanup; timeout/SIGKILL requests termination but does not certify descendant cleanup or bound native IO. Stderr capture has no explicit byte quota, and cleanup/release/process failures remain named aggregate observations. Body existence is separate from selection/runtime execution.
 */
export async function test_runtime_directory_lock_serializes_claim_and_clean(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-runtime-lock-"));
  const runtime = path.join(root, "ttsx");
  const ready = path.join(root, "ready");
  const attempting = path.join(root, "attempting");
  const release = path.join(root, "release");
  const entered = path.join(root, "entered");
  const worker = path.join(root, "worker.cjs");
  const modulePath = fileURLToPath(
    new URL(
      "../../../../../packages/ttsc/src/launcher/internal/runtime/withRuntimeDirectoryLock.ts",
      import.meta.url,
    ),
  );
  const loader = new URL(
    "../../../../../config/register-unit-loader.mjs",
    import.meta.url,
  ).href;
  type Outcome = {
    code: number | null;
    signal: NodeJS.Signals | null;
    output: string;
  };
  const workers: Promise<Outcome>[] = [];
  const failures: Error[] = [];
  const observe = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const waits = new AbortController();
  let results: PromiseSettledResult<Outcome>[] = [];
  try {
    try {
      fs.writeFileSync(
        worker,
        [
          'const fs = require("node:fs");',
          `const { withRuntimeDirectoryLock } = require(${JSON.stringify(modulePath)});`,
          `const runtime = ${JSON.stringify(runtime)};`,
          `const ready = ${JSON.stringify(ready)};`,
          `const attempting = ${JSON.stringify(attempting)};`,
          `const release = ${JSON.stringify(release)};`,
          `const entered = ${JSON.stringify(entered)};`,
          'if (process.argv[2] === "holder") {',
          "  withRuntimeDirectoryLock(runtime, () => {",
          '    fs.writeFileSync(ready, "ready");',
          "    while (!fs.existsSync(release)) {",
          "      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);",
          "    }",
          "  });",
          "} else {",
          '  fs.writeFileSync(attempting, "attempting");',
          "  withRuntimeDirectoryLock(runtime, () => {",
          '    fs.writeFileSync(entered, "entered");',
          "  });",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );
      const start = (mode: string): Promise<Outcome> => {
        const child = childProcess.spawn(
          process.execPath,
          ["--import", loader, worker, mode],
          {
            cwd: root,
            stdio: ["ignore", "ignore", "pipe"],
            windowsHide: true,
            timeout: 120_000,
            killSignal: "SIGKILL",
          },
        );
        let output = "";
        child.stderr?.on("data", (chunk: Buffer) => {
          output += chunk.toString("utf8");
        });
        return new Promise((resolve, reject) => {
          child.once("error", reject);
          child.once("close", (code, signal) =>
            resolve({ code, signal, output }),
          );
        });
      };
      const waitFor = async (file: string): Promise<void> => {
        const deadline = Date.now() + 30_000;
        while (!fs.existsSync(file)) {
          if (waits.signal.aborted) return;
          assert.ok(Date.now() < deadline, `worker did not write ${file}`);
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      };
      const holder = start("holder");
      workers.push(holder);
      await Promise.race([
        waitFor(ready),
        holder.then(({ code, signal, output }) => {
          throw new Error(
            `holder exited before claiming: ${code}/${signal}\n${output}`,
          );
        }),
      ]);
      observe("holder ready bytes", () => {
        assert.equal(fs.readFileSync(ready, "utf8"), "ready");
      });
      const contender = start("contender");
      workers.push(contender);
      await Promise.race([
        waitFor(attempting),
        contender.then(({ code, signal, output }) => {
          throw new Error(
            `contender exited before attempting: ${code}/${signal}\n${output}`,
          );
        }),
      ]);
      observe("contender attempting bytes", () => {
        assert.equal(fs.readFileSync(attempting, "utf8"), "attempting");
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      observe("contender excluded during held interval", () => {
        assert.equal(
          fs.existsSync(entered),
          false,
          "the contender bypassed the lock",
        );
      });
    } catch (cause) {
      failures.push(
        new Error("runtime lock worker preparation and barriers", { cause }),
      );
    } finally {
      waits.abort();
      try {
        fs.writeFileSync(release, "release", "utf8");
      } catch (cause) {
        failures.push(
          new Error("runtime lock release barrier write", { cause }),
        );
      } finally {
        results = await Promise.allSettled(workers);
      }
    }
    observe("both worker roles were acquired", () => {
      assert.equal(results.length, 2);
    });
    for (const [index, result] of results.entries()) {
      const role = index === 0 ? "holder" : "contender";
      if (result.status === "rejected") {
        failures.push(
          new Error(`${role} worker launch/completion`, {
            cause: result.reason,
          }),
        );
        continue;
      }
      const outcome = result.value;
      observe(`${role} worker exits zero`, () => {
        assert.equal(outcome.code, 0, outcome.output);
      });
      observe(`${role} worker exits without signal`, () => {
        assert.equal(outcome.signal, null, outcome.output);
      });
    }
    observe("release barrier bytes", () => {
      assert.equal(fs.readFileSync(release, "utf8"), "release");
    });
    observe("contender eventually enters", () => {
      assert.equal(fs.existsSync(entered), true);
    });
    observe("contender entered bytes", () => {
      assert.equal(fs.readFileSync(entered, "utf8"), "entered");
    });
  } finally {
    observe("runtime lock root cleanup after worker settlement", () => {
      fs.rmSync(root, { recursive: true, force: true });
    });
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "runtime lock worker observations failed",
    );
}
