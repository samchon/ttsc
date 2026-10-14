import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WindowsColdFileIo } from "../../../utils/src/WindowsColdFileIo";
import { WindowsFileIoEvidence } from "../../../utils/src/WindowsFileIoEvidence";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies optional recorder state owns startup, joined stop and failure output.
 *
 * Diagnostic refusal cannot skip the original test or fabricate joined native recording; repeated stop must retain one original retirement result.
 *
 * 1. Disable recording and assert no owned runner executes; start one enabled
 *    owner through an explicit runner and bind its independently authored task.
 * 2. Stop concurrently and assert one stop/decode sequence and separately selected
 *    task/control evidence, with unknown loss and unrelated paths omitted.
 * 3. Refuse startup and then native stop in separate owners, preserving their
 *    original error objects and explicit unconfirmed recording metadata.
 * 4. Retain raw storage under unconfirmed stop, then run owned workflow cleanup
 *    and require joined reclamation while the original source stays untouched.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual recorder state and selector execute through an owned runner. Separate source/control scopes admit their own exact paths from one decoded population; supplied device mapping, independent birth and IRP completion connect the authored control without expanding source selection. Decoder-stage prefixes survive refusal, legacy/malformed metadata is not measured zero, and original decode/parse failures remain separate. Interrupted state prefixes preserve the immutable plan, no-attempt admissions differ from partial stop acknowledgment, and real output-path collisions retain original refusal plus publication errors and the shutdown capability.
 * @evidence contracts/testing.md#independent-expectations Authored native-operation receipts and refusal objects define joined and failed recorder states. The contract requires one stop, no decoding before joined stop, and no original product-input deletion; literal mode order and returned failure identity pin these independently.
 * @evidence contracts/testing.md#distinguishing-cases A connected control is observed despite unknown loss/wrap; missing control evidence is decisive only with measured zero loss and explicit false wrap/decoder flags plus qualified selector history. Null/missing flags, positive loss and incomplete selector history remain censored; absent selection remains unavailable. Completed empty decoding, legacy missing counts, a refused partial prefix and malformed metadata differ. Disabled admission, successful concurrent stop, immutable binding/plan, interrupted journal prefix, unprintable refusal, dual startup/publication failure, no native attempt, partial sibling acknowledgment, unknown stop and joined reclamation differ. Actual default-account schema/recorder transport belongs to the cold Graph E2E case.
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
  const controlScratch = "Q:\\control\\scratch";
  const controlBirth = "2026-10-14T00:00:00.01Z";
  const control = { token: "independent-control", scratch: controlScratch, processes: [{ pid: 107, identity: controlBirth }] };
  const run = async (mode: "start" | "stop" | "decode", manifest: string) => {
    calls.push(mode);
    const owner = JSON.parse(fs.readFileSync(manifest, "utf8")) as { private: string };
    const write = (name: string, value: unknown) => fs.writeFileSync(path.join(owner.private, name), JSON.stringify(value));
    if (mode === "start") {
      write("started.json", { devices: [{ dos: "Q:", native: "\\Device\\ObservedControlVolume" }] });
      write("before.json", { at: "2026-10-14T00:00:00Z", processes: [] });
      write("capability.json", { administrator: true });
    } else if (mode === "stop") write("stopped.json", { sessions: [{ state: "stopped", code: 0 }, { state: "stopped", code: 0 }] });
    else {
      write("decoded.json", { eventsLost: null, possibleWrap: true, decodingFailed: false, failures: [], stages: [{ provider: "file", enumerated: 5, matchingProvider: 4, acceptedRevision: 4, projected: 4, completed: true, failure: null }] });
      fs.writeFileSync(path.join(owner.private, "events.jsonl"), [
        { provider: "process", id: 1, version: 1, at: "2026-10-14T00:00:00.1Z", headerPid: 4, fields: { ProcessID: "107", CreateTime: controlBirth } },
        { provider: "process", id: 3, version: 1, at: "2026-10-14T00:00:00.2Z", headerPid: 4, fields: { ProcessID: "107", ThreadID: "900" } },
        { provider: "file", id: 12, version: 1, at: "2026-10-14T00:00:01Z", headerPid: 4, fields: { FileObject: "0x1", Irp: "0x2", FileName: scratch + "\\source.go" } },
        { provider: "file", id: 12, version: 1, at: "2026-10-14T00:00:02Z", headerPid: 4, fields: { FileObject: "0x3", Irp: "0x4", FileName: "Q:\\unrelated\\private.txt" } },
        { provider: "file", id: 12, version: 1, at: "2026-10-14T00:00:03Z", headerPid: 4, fields: { FileObject: "0x5", Irp: "0x6", IssuingThreadId: "900", FileName: "\\Device\\ObservedControlVolume\\control\\scratch\\owned-control.txt" } },
        { provider: "file", id: 24, version: 1, at: "2026-10-14T00:00:03.1Z", headerPid: 4, fields: { Irp: "6", Status: "0x0" } },
      ].map((event) => JSON.stringify(event)).join("\n") + "\n");
    }
  };
  try {
    assert.deepEqual(await WindowsColdFileIo.open({ enabled: false, traceRoot: "relative", runnerTemp: "relative", fixture: "unused", run }), {});
    assert.deepEqual(calls, []);
    const opened = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run });
    assert.equal(opened.failure, undefined);
    opened.owner!.bind({ token: "original-task", scratch, processes: [] });
    opened.owner!.bindControl(control);
    assert.throws(() => opened.owner!.bindControl({ ...control, token: "replacement-control" }), /immutable/);
    assert.throws(() => opened.owner!.bind({ token: "different-task", scratch, processes: [] }), /immutable/);
    const stopping = opened.owner!.stop();
    assert.equal(opened.owner!.stop(), stopping);
    const selectedControl = await stopping;
    assert.deepEqual(calls, ["start", "stop", "decode"]);
    const evidenceFile = fs.readdirSync(traceRoot).find((name) => name.startsWith("graph-fileio-evidence-"))!;
    const evidence = JSON.parse(fs.readFileSync(path.join(traceRoot, evidenceFile), "utf8"));
    assert.equal(evidence.joinedRecorder, true);
    assert.equal(evidence.evidence.taskToken, "original-task");
    assert.equal(evidence.evidence.selected.length, 1);
    assert.deepEqual(evidence.decodeStages, [{ provider: "file", enumerated: 5, matchingProvider: 4, acceptedRevision: 4, projected: 4, completed: true, failure: null }]);
    assert.deepEqual(evidence.evidence.counts, { processRows: 2, fileRows: 4, selectedRequests: 1, selectedOperationEnds: 0, unconnectedRequests: 2, orphanOperationEnds: 1 });
    assert.deepEqual(selectedControl, evidence.controlEvidence, "Stop must return this recording's separate selected control");
    assert.deepEqual(evidence.controlTask, control);
    assert.equal(selectedControl!.taskToken, control.token);
    assert.deepEqual(selectedControl!.counts, { processRows: 2, fileRows: 4, selectedRequests: 1, selectedOperationEnds: 1, unconnectedRequests: 2, orphanOperationEnds: 0 });
    assert.equal(selectedControl!.selected[0]!.objectGeneration, selectedControl!.selected[1]!.objectGeneration);
    assert.equal((selectedControl!.selected[1]!.completionDecoded as { ntSuccess: boolean }).ntSuccess, true);
    assert.equal((selectedControl!.selected[0]!.owner as { original: boolean }).original, true);
    assert.equal(selectedControl!.readerAbsence, "not-established");
    assert.equal(selectedControl!.completeness, "unknown");
    const expectedControl = { ...control, fileName: "owned-control.txt" };
    assert.equal(WindowsFileIoEvidence.control(selectedControl, expectedControl).status, "observed", "An exact positive pair survives unrelated loss/wrap uncertainty");
    assert.throws(() => WindowsFileIoEvidence.control(selectedControl, { ...expectedControl, token: "different-control" }), /different task selection/);
    const unavailableControl = WindowsFileIoEvidence.control(undefined, expectedControl);
    assert.equal(unavailableControl.status, "unavailable");
    assert.equal(unavailableControl.knownCreateCount, null, "Unavailable selection is not an observed zero");
    const completeLoss = { eventsLost: 0, possibleWrap: false, decodingFailed: false };
    const emptyControl = WindowsFileIoEvidence.select([], { ...control, devices: [], loss: completeLoss });
    assert.equal(WindowsFileIoEvidence.control(emptyControl, expectedControl).status, "missing", "A qualified empty population fails the known-file positive control");
    for (const loss of [
      { ...completeLoss, eventsLost: null },
      { ...completeLoss, eventsLost: 1 },
      { ...completeLoss, possibleWrap: true },
      { ...completeLoss, decodingFailed: true },
      { ...completeLoss, possibleWrap: null },
      { ...completeLoss, possibleWrap: undefined },
      { ...completeLoss, decodingFailed: null },
      { ...completeLoss, decodingFailed: undefined },
    ]) {
      // Parsed native metadata can omit a field; unavailable is not false.
      const parsedLoss = JSON.parse(JSON.stringify(loss));
      const censoredControl = WindowsFileIoEvidence.select([], { ...control, devices: [], loss: parsedLoss });
      assert.equal(WindowsFileIoEvidence.control(censoredControl, expectedControl).status, "censored");
    }
    const incompleteControl = WindowsFileIoEvidence.select([
      { provider: "file", id: 26, version: 1, at: "2026-10-14T00:00:04Z", headerPid: 4, fields: { FilePath: controlScratch + "\\owned-control.txt" } },
    ], { ...control, devices: [], loss: completeLoss });
    assert.equal(incompleteControl.completeness, "unknown");
    assert.equal(WindowsFileIoEvidence.control(incompleteControl, expectedControl).status, "censored", "Unqualified selector history cannot turn absent Creates into a failure");
    assert.equal(JSON.stringify(evidence.evidence).includes("owned-control.txt"), false, "Control paths must not widen source-task evidence");
    assert.equal(JSON.stringify(selectedControl).includes("source.go"), false, "Source paths must not widen control evidence");
    assert.equal(evidence.evidence.readerAbsence, "not-established");
    assert.equal(JSON.stringify(evidence).includes("private.txt"), false);
    assert.equal(fs.readFileSync(input, "utf8"), "retained original source");

    let noControlManifest = "";
    const noControl = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
      noControlManifest = manifest;
      await run(mode, manifest);
    } });
    noControl.owner!.bind({ token: "source-without-control", scratch, processes: [] });
    assert.equal(await noControl.owner!.stop(), undefined, "An unbound control cannot become a measured empty selection");
    assert.throws(() => noControl.owner!.bindControl(control), /immutable/, "A stopped population cannot admit a late control");
    const noControlEvidence = JSON.parse(fs.readFileSync(noControlManifest.replace("graph-fileio-owner-", "graph-fileio-evidence-"), "utf8"));
    assert.equal(noControlEvidence.controlTask, null);
    assert.equal(noControlEvidence.controlEvidence, null);

    // The same owned runner supplies decoder outcomes without invoking ETW.
    // Missing or broken metadata must differ from an actually completed zero.
    for (const outcome of ["empty", "legacy", "partial", "broken"] as const) {
      let outcomeManifest = "";
      const decodeRefusal = new Error(`authored ${outcome} decoder refusal`);
      const observation = await WindowsColdFileIo.open({ enabled: true, traceRoot, runnerTemp, fixture: "unused", run: async (mode, manifest) => {
        outcomeManifest = manifest;
        if (mode !== "decode") return run(mode, manifest);
        const plan = JSON.parse(fs.readFileSync(manifest, "utf8"));
        const metadata = { eventsLost: null, possibleWrap: true, decodingFailed: false, failures: [] as string[] };
        if (outcome === "broken") {
          fs.writeFileSync(path.join(plan.private, "decoded.json"), '{"stages":[');
          throw decodeRefusal;
        }
        fs.writeFileSync(path.join(plan.private, "events.jsonl"), "");
        fs.writeFileSync(path.join(plan.private, "decoded.json"), JSON.stringify({ ...metadata,
          ...(outcome === "legacy" ? {} : { stages: [{ provider: "file", enumerated: outcome === "partial" ? 2 : 0, matchingProvider: outcome === "partial" ? 1 : 0, acceptedRevision: 0, projected: 0, completed: outcome !== "partial", failure: outcome === "partial" ? decodeRefusal.message : null }] }),
        }));
        if (outcome === "partial") throw decodeRefusal;
      } });
      observation.owner!.bind({ token: `original-${outcome}`, scratch, processes: [] });
      observation.owner!.bindControl(control);
      if (outcome === "partial" || outcome === "broken") {
        await assert.rejects(observation.owner!.stop(), (error: unknown) => error instanceof AggregateError && error.errors[0] === decodeRefusal && (outcome !== "broken" || error.errors[1] instanceof SyntaxError));
      } else await observation.owner!.stop();
      const observed = JSON.parse(fs.readFileSync(outcomeManifest.replace("graph-fileio-owner-", "graph-fileio-evidence-"), "utf8"));
      if (outcome === "legacy" || outcome === "broken") assert.equal(observed.decodeStages, null, "unavailable counters are unknown rather than measured zero");
      else {
        assert.equal(observed.decodeStages[0].completed, outcome === "empty");
        assert.equal(observed.decodeStages[0].enumerated, outcome === "empty" ? 0 : 2);
      }
      if (outcome === "partial" || outcome === "broken") {
        assert.equal(observed.evidence, null);
        assert.equal(observed.controlEvidence, null, "Unavailable control decoding is not a completed zero selection");
        assert.equal(observed.loss.decodingFailed, true);
        assert.ok(observed.failures[0].includes(decodeRefusal.message));
      } else {
        assert.equal(observed.evidence.counts.fileRows, 0);
        assert.equal(observed.evidence.readerAbsence, "not-established");
        assert.equal(observed.evidence.completeness, "unknown");
        assert.equal(observed.controlEvidence.counts.fileRows, 0);
        assert.deepEqual(observed.controlEvidence.selected, [], "Completed empty control selection remains an observed empty population");
      }
    }

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
