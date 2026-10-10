import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setImmediate } from "node:timers/promises";

import { LspCompletionPublication } from "../../../../utils/src/LspCompletionPublication";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies initial completion readiness follows the producer's actual terminal.
 *
 * Controlled trace writes distinguish pending work from empty success and
 * failure without a wall-clock expectation or native producer preparation.
 *
 * 1. Replay successful and empty initial publications and ignore other owners.
 * 2. Keep a partial initial record pending until the producer completes it.
 * 3. Reject native run/decode failure, invalid evidence and actual child close.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes the actual LspCompletionPublication.wait against owned JSONL writes and a caller-owned close Promise. Resolution/rejection assertions distinguish real initial publication from pending, unrelated or failed state; pending checks are separated by explicit microtask/event-loop turns rather than elapsed deadlines.
 * @evidence contracts/testing.md#independent-expectations Literal native observer records use schema one, exact cwd/producer, generation one and published/run-failed/decode-failed discriminants. Readiness follows the source's terminal contract; error regexes distinguish its native failure from missing terminal and malformed evidence.
 * @evidence contracts/testing.md#distinguishing-cases Covers preexisting nonempty/empty success, later complete publication, partial append framing, wrong cwd/producer/generation, failed run/decode, corrupt JSON, integrity failure, missing root, actual close with no publication and failed close observation with its original cause. No test asserts a maximum positive duration or infers readiness from diagnostics.
 * @evidence contracts/testing.md#execution-ownership The named source unit calls the maintained shared test helper directly with real owned filesystem inputs and controlled Promises. It builds/starts no compiler, producer, host or installed consumer; the E2E editor owns native event emission and actual completion items. Every watcher settles before its case directory is removed.
 */
export async function test_lsp_completion_publication_observes_producer_terminal(): Promise<void> {
  const root = TestProject.tmpdir("lsp-publication-");
  const cwd = path.join(root, "project");
  const producer = "@ttsc/lint";
  const record = (data: Record<string, unknown> = {}, owner = cwd) => JSON.stringify({
    schema: 1,
    event: "lsp-hints-publication",
    cwd: owner,
    data: { producer, generation: 1, outcome: "published", hints: 1, ...data },
  });
  let ordinal = 0;
  const scenario = async (body: (directory: string, closed: Promise<void>, close: () => void) => Promise<void>) => {
    const directory = path.join(root, String(ordinal++));
    fs.mkdirSync(directory);
    let close!: () => void;
    const closed = new Promise<void>((resolve) => { close = resolve; });
    try {
      await body(directory, closed, close);
    } finally {
      close();
      await setImmediate();
      fs.rmSync(directory, { recursive: true });
    }
  };
  const failures: unknown[] = [];
  const cases: (() => Promise<void>)[] = [];
  for (const hints of [0, 1]) cases.push(() => scenario(async (directory, closed) => {
    fs.writeFileSync(path.join(directory, "producer.jsonl"), record({ hints }) + "\n");
    await LspCompletionPublication.wait(directory, cwd, producer, closed);
  }));
  cases.push(() => scenario(async (directory, closed) => {
    const alias = path.join(root, "trace-alias");
    fs.symlinkSync(directory, alias, process.platform === "win32" ? "junction" : "dir");
    try {
      fs.writeFileSync(path.join(directory, "producer.jsonl"), record() + "\n");
      await LspCompletionPublication.wait(alias, cwd, producer, closed);
    } finally { fs.unlinkSync(alias); }
  }));
  cases.push(() => scenario(async (directory, closed) => {
    const file = path.join(directory, "producer.jsonl");
    fs.writeFileSync(file, [record({}, cwd + "-other"), record({ producer: "other" }), record({ generation: 2 })].join("\n") + "\n");
    let completed = false;
    const pending = LspCompletionPublication.wait(directory, cwd, producer, closed).then(() => { completed = true; });
    void pending.catch(() => {});
    await setImmediate();
    assert.equal(completed, false);
    const terminal = record();
    fs.appendFileSync(file, terminal.slice(0, -1));
    await setImmediate();
    assert.equal(completed, false);
    fs.appendFileSync(file, terminal.slice(-1) + "\n");
    await pending;
    assert.equal(completed, true);
  }));
  for (const outcome of ["run-failed", "decode-failed"]) cases.push(() => scenario(async (directory, closed) => {
    fs.writeFileSync(path.join(directory, "producer.jsonl"), record({ outcome, error: "authored failure" }) + "\n");
    await assert.rejects(LspCompletionPublication.wait(directory, cwd, producer, closed), new RegExp(outcome + ": authored failure"));
  }));
  cases.push(() => scenario(async (directory, closed, close) => {
    const pending = LspCompletionPublication.wait(directory, cwd, producer, closed);
    close();
    await assert.rejects(pending, /closed before initial completion publication/);
  }));
  cases.push(() => scenario(async (directory) => {
    const cause = new Error("authored close failure");
    await assert.rejects(
      LspCompletionPublication.wait(directory, cwd, producer, Promise.reject(cause)),
      (error: unknown) => error instanceof Error && error.message === "ttscserver close observation failed" && error.cause === cause,
    );
  }));
  cases.push(() => scenario(async (directory, closed) => {
    fs.writeFileSync(path.join(directory, "producer.jsonl"), "{invalid}\n");
    await assert.rejects(LspCompletionPublication.wait(directory, cwd, producer, closed), SyntaxError);
  }));
  cases.push(() => scenario(async (directory, closed) => {
    fs.writeFileSync(path.join(directory, "producer.jsonl"), JSON.stringify({ event: "integrity-failure" }) + "\n");
    await assert.rejects(LspCompletionPublication.wait(directory, cwd, producer, closed), /trace integrity failure/);
  }));
  cases.push(() => scenario(async (directory, closed) => {
    await assert.rejects(LspCompletionPublication.wait(path.join(directory, "missing"), cwd, producer, closed), { code: "ENOENT" });
  }));
  try {
    for (const entry of cases) {
      try { await entry(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, "Initial completion publication cases");
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
