import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WindowsColdFileIo } from "../../../utils/src/WindowsColdFileIo";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies optional recorder state owns startup, joined stop and failure output.
 *
 * Diagnostic refusal cannot skip the original test or fabricate joined native recording; repeated stop must retain one original retirement result.
 *
 * 1. Disable recording and assert no owned runner executes; start one enabled
 *    owner through an explicit runner and bind its independently authored task.
 * 2. Stop concurrently and assert one stop/decode sequence and selected evidence,
 *    with unknown loss retained and no unrelated raw process/file rows exported.
 * 3. Refuse startup and then native stop in separate owners, preserving their
 *    original error objects and explicit unconfirmed recording metadata.
 * 4. Retain raw storage under unconfirmed stop, then run owned workflow cleanup
 *    and require joined reclamation while the original source stays untouched.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual recorder state and selector execute through an owned runner. Interrupted state prefixes preserve the immutable plan, no-attempt admissions differ from partial stop acknowledgment, and real output-path collisions retain original refusal plus publication errors and the shutdown capability.
 * @evidence contracts/testing.md#independent-expectations Authored native-operation receipts and refusal objects define joined and failed recorder states. The contract requires one stop, no decoding before joined stop, and no original product-input deletion; literal mode order and returned failure identity pin these independently.
 * @evidence contracts/testing.md#distinguishing-cases Disabled admission, successful concurrent stop, immutable binding/plan, interrupted journal prefix, unprintable refusal, dual startup/publication failure, no native attempt, partial sibling acknowledgment, unknown stop and joined reclamation differ. Actual default-account schema/recorder transport belongs to the cold Graph E2E case.
 * @evidence contracts/testing.md#execution-ownership This source unit supplies its own operation runner and filesystem metadata receipts to the shared state owner, with no native ETW session, child process, compiler or installed consumer; it changes no global method or environment.
 */
export async function test_windows_fileio_recorder_preserves_original_stop_and_failures(): Promise<void> {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-fileio-owner-"));
  const runnerTemp = path.join(root, "runner");
  const traceRoot = path.join(root, "observations");
  fs.mkdirSync(runnerTemp);
  fs.mkdirSync(traceRoot);
  const calls: string[] = [];
  const input = path.join(root, "original-source.txt");
  fs.writeFileSync(input, "retained original source");
  const scratch = "Q:\\original\\scratch";
  const run = async (mode: "start" | "stop" | "decode", manifest: string) => {
    calls.push(mode);
    const owner = JSON.parse(fs.readFileSync(manifest, "utf8")) as { private: string };
    const write = (name: string, value: unknown) => fs.writeFileSync(path.join(owner.private, name), JSON.stringify(value));
    if (mode === "start") {
      write("started.json", { devices: [] });
      write("before.json", { at: "2026-10-14T00:00:00Z", processes: [] });
      write("capability.json", { administrator: true });
    } else if (mode === "stop") write("stopped.json", { sessions: [{ state: "stopped", code: 0 }, { state: "stopped", code: 0 }] });
    else {
      write("decoded.json", { eventsLost: null, possibleWrap: true, decodingFailed: false, failures: [] });
      fs.writeFileSync(path.join(owner.private, "events.jsonl"), [
        { provider: "file", id: 12, version: 1, at: "2026-10-14T00:00:01Z", headerPid: 4, fields: { FileObject: "0x1", Irp: "0x2", FileName: scratch + "\\source.go" } },
        { provider: "file", id: 12, version: 1, at: "2026-10-14T00:00:02Z", headerPid: 4, fields: { FileObject: "0x3", Irp: "0x4", FileName: "Q:\\unrelated\\private.txt" } },
      ].map((event) => JSON.stringify(event)).join("\n") + "\n");
    }
  };
  try {
    assert.deepEqual(await WindowsColdFileIo.open({ enabled: false, traceRoot: "relative", runnerTemp: "relative", fixture: "unused", run }), {});
    assert.deepEqual(calls, []);
    const opened = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run });
    assert.equal(opened.failure, undefined);
    opened.owner!.bind({ token: "original-task", scratch, processes: [] });
    assert.throws(() => opened.owner!.bind({ token: "different-task", scratch, processes: [] }), /immutable/);
    const stopping = opened.owner!.stop();
    assert.equal(opened.owner!.stop(), stopping);
    await stopping;
    assert.deepEqual(calls, ["start", "stop", "decode"]);
    const evidenceFile = fs.readdirSync(traceRoot).find((name) => name.startsWith("graph-fileio-evidence-"))!;
    const evidence = JSON.parse(fs.readFileSync(path.join(traceRoot, evidenceFile), "utf8"));
    assert.equal(evidence.joinedRecorder, true);
    assert.equal(evidence.evidence.taskToken, "original-task");
    assert.equal(evidence.evidence.selected.length, 1);
    assert.equal(evidence.evidence.readerAbsence, "not-established");
    assert.equal(JSON.stringify(evidence).includes("private.txt"), false);
    assert.equal(fs.readFileSync(input, "utf8"), "retained original source");

    const refusal = new Error("authored recorder start refusal");
    const failed = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      if (mode === "start") throw refusal;
      await run(mode, manifest);
    } });
    assert.equal(failed.failure, refusal);
    await failed.owner!.stop();
    const stopRefusal = new Error("authored recorder stop refusal");
    const unjoined = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      if (mode === "stop") throw stopRefusal;
      await run(mode, manifest);
    } });
    await assert.rejects(unjoined.owner!.stop(), (error: unknown) => error instanceof AggregateError && error.errors[0] === stopRefusal);
    const pending = fs.readdirSync(traceRoot).filter((name) => name.startsWith("graph-fileio-owner-")).map((name) => ({ file: path.join(traceRoot, name), record: JSON.parse(fs.readFileSync(path.join(traceRoot, name), "utf8")) })).find(({ record }) => fs.existsSync(record.private))!;
    const originalPlan = fs.readFileSync(pending.file, "utf8");
    const pendingJournal = pending.file.replace("graph-fileio-owner-", "graph-fileio-state-");
    fs.appendFileSync(pendingJournal, '{"stopJoined":true');
    assert.equal(fs.existsSync(pending.record.private), true);
    await assert.rejects(WindowsColdFileIo.cleanup(traceRoot, "unused", runnerTemp, async (_mode, manifest) => {
      const owner = JSON.parse(fs.readFileSync(manifest, "utf8"));
      fs.writeFileSync(path.join(owner.private, "stopped.json"), JSON.stringify({ sessions: [{ state: "stopped", code: 0 }, { state: "query-unavailable", query: { code: 5, output: "authored access denial" } }] }));
    }), /cleanup failed/);
    assert.equal(fs.existsSync(pending.record.private), true, "unknown native stop must retain original recorder storage");
    const interrupted = fs.readdirSync(traceRoot).find((name) => name.startsWith("graph-fileio-interrupted-"))!;
    const unknown = JSON.parse(fs.readFileSync(path.join(traceRoot, interrupted), "utf8"));
    assert.equal(unknown.joinedRecorder, false);
    assert.equal(unknown.readerAbsence, "not-established");
    assert.equal(unknown.evidence, null);
    assert.equal(unknown.interruptedState, true);
    assert.equal(unknown.retirement.sessions[1].query.code, 5);
    assert.equal(unknown.retirement.sessions[1].query.output, "authored access denial");
    await WindowsColdFileIo.cleanup(traceRoot, "unused", runnerTemp, run);
    assert.equal(fs.existsSync(pending.record.private), false);
    assert.equal(fs.readFileSync(pending.file, "utf8"), originalPlan, "state publication must never rewrite the original fallback plan");

    let failedManifest = "";
    const doubleFailure = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      if (mode !== "start") return run(mode, manifest);
      failedManifest = manifest;
      await run(mode, manifest);
      fs.mkdirSync(manifest.replace("graph-fileio-owner-", "graph-fileio-state-"));
      throw refusal;
    } });
    assert.ok(doubleFailure.owner, "secondary startup publication refusal must not lose the original owner");
    assert.ok(doubleFailure.failure instanceof AggregateError);
    assert.equal(doubleFailure.failure.errors[0], refusal);
    assert.equal(doubleFailure.failure.errors.length, 2);
    const fixedPlan = fs.readFileSync(failedManifest, "utf8");
    fs.rmdirSync(failedManifest.replace("graph-fileio-owner-", "graph-fileio-state-"));
    await doubleFailure.owner!.stop();
    assert.equal(fs.readFileSync(failedManifest, "utf8"), fixedPlan);

    let publicationManifest = "";
    const secondary = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      publicationManifest = manifest;
      await run(mode, manifest);
      if (mode === "stop") {
        fs.mkdirSync(manifest.replace("graph-fileio-owner-", "graph-fileio-evidence-"));
        throw stopRefusal;
      }
    } });
    secondary.owner!.bind({ token: "actual-stop-refusal", scratch, processes: [] });
    await assert.rejects(secondary.owner!.stop(), (error: unknown) => error instanceof AggregateError && error.errors[0] === stopRefusal && error.errors.length === 2);
    const secondaryPlan = JSON.parse(fs.readFileSync(publicationManifest, "utf8"));
    assert.equal(fs.existsSync(secondaryPlan.private), true, "failed publication must retain joined raw evidence");
    await WindowsColdFileIo.cleanup(traceRoot, "unused", runnerTemp, async () => { throw new Error("already acknowledged native stop must not be repeated"); });
    assert.equal(fs.existsSync(secondaryPlan.private), false);
    let absentManifest = "";
    const absent = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      absentManifest = manifest;
      const plan = JSON.parse(fs.readFileSync(manifest, "utf8"));
      const receipts = { sessions: [{ state: "not-admitted", attempted: false }, { state: "not-admitted", attempted: false }] };
      fs.writeFileSync(path.join(plan.private, mode === "start" ? "admission.json" : "stopped.json"), JSON.stringify(receipts));
      if (mode === "start") throw refusal;
      assert.equal(mode, "stop", "no-admission must not decode nonexistent native recording");
    } });
    assert.equal(absent.failure, refusal);
    await absent.owner!.stop();
    const absentEvidence = JSON.parse(fs.readFileSync(absentManifest.replace("graph-fileio-owner-", "graph-fileio-evidence-"), "utf8"));
    assert.equal(absentEvidence.joinedRecorder, true);
    assert.equal(absentEvidence.retirement.sessions.every((entry: { state: string }) => entry.state === "not-admitted"), true);

    let partialManifest = "";
    const partial = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      partialManifest = manifest;
      const plan = JSON.parse(fs.readFileSync(manifest, "utf8"));
      const receipts = { sessions: [{ state: "stopped", code: 0, stop: { code: 0, output: "original partial-start cleanup acknowledgment" } }, { state: "query-unavailable", query: { code: 5, output: "failed-create ownership unconfirmed" } }] };
      fs.writeFileSync(path.join(plan.private, mode === "start" ? "admission.json" : "stopped.json"), JSON.stringify(receipts));
      if (mode === "start") throw refusal;
    } });
    assert.equal(partial.failure, refusal);
    await assert.rejects(partial.owner!.stop(), /diagnostics failed/);
    const partialEvidence = JSON.parse(fs.readFileSync(partialManifest.replace("graph-fileio-owner-", "graph-fileio-evidence-"), "utf8"));
    assert.equal(partialEvidence.joinedRecorder, false);
    assert.equal(partialEvidence.retirement.sessions[0].stop.output, "original partial-start cleanup acknowledgment");
    assert.equal(partialEvidence.retirement.sessions[1].query.code, 5);
    const opaque = Proxy.revocable({}, {});
    opaque.revoke();
    const unprintable = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      if (mode === "start") throw opaque.proxy;
      return run(mode, manifest);
    } });
    assert.equal(unprintable.failure, opaque.proxy);
    await unprintable.owner!.stop();
    const undefinedRefusal = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      if (mode === "start") throw undefined;
      return run(mode, manifest);
    } });
    assert.equal("failure" in undefinedRefusal, true, "undefined rejection must remain a failed outcome for the consumer");
    assert.equal(undefinedRefusal.failure, undefined);
    assert.equal("failure" in opened, false, "successful startup has no refusal property");
    await undefinedRefusal.owner!.stop();

    let interruptedManifest = "";
    const readRefusal = new Error("authored interrupted native receipt observation");
    const interruptedReads = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      interruptedManifest = manifest;
      const plan = JSON.parse(fs.readFileSync(manifest, "utf8"));
      if (mode === "start") {
        await run(mode, manifest);
        fs.writeFileSync(path.join(plan.private, "admission.json"), '{"sessions":[');
        fs.writeFileSync(path.join(plan.private, "stopped.json"), '{"sessions":[{"state":"stopped"');
      } else if (mode === "stop") {
        // The owned transport has independently retired both original siblings
        // despite their damaged prior receipts; this is authored data, not an
        // assertion that a Windows host was exercised by this unit.
        fs.writeFileSync(path.join(plan.private, "stopped.json"), JSON.stringify({
          sessions: [{ state: "stopped", code: 0, stop: { code: 0, output: "first original acknowledgment" } }, { state: "stopped", code: 0, stop: { code: 0, output: "second original acknowledgment" } }],
          receiptFailures: ["partial admission JSON", "partial stopped JSON"],
        }));
        throw readRefusal;
      } else await run(mode, manifest);
    } });
    interruptedReads.owner!.bind({ token: "interrupted-original", scratch, processes: [] });
    await assert.rejects(interruptedReads.owner!.stop(), (error: unknown) => error instanceof AggregateError && error.errors[0] === readRefusal);
    const readEvidence = JSON.parse(fs.readFileSync(interruptedManifest.replace("graph-fileio-owner-", "graph-fileio-evidence-"), "utf8"));
    assert.equal(readEvidence.joinedRecorder, true);
    assert.deepEqual(readEvidence.retirement.receiptFailures, ["partial admission JSON", "partial stopped JSON"]);
    assert.equal(readEvidence.retirement.sessions[1].stop.output, "second original acknowledgment");
    assert.equal(fs.readFileSync(input, "utf8"), "retained original source");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
