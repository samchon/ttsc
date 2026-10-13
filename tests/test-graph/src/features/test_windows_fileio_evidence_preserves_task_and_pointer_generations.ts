import assert from "node:assert/strict";

import { WindowsFileIoEvidence } from "../../../utils/src/WindowsFileIoEvidence";

/**
 * Verifies task evidence keeps pointer, issuer and process generations separate.
 *
 * Numeric pointer rounding, PID reuse or a missing Close can otherwise create
 * an ownership claim that the actual event sequence never established.
 *
 * 1. Select an original mapped scratch Create, sharing flags, delete request
 *    and failing completion under independently authored process/thread births.
 * 2. Reuse FileObject/IRP/PID/thread identities beside unrelated file events and
 *    require exact pointer handling and conservative generation attribution.
 * 3. Retain missing starts/completions, malformed status and loss/wrap as unknown;
 *    no row may establish reader absence from missing native events.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual portable selector connects named Create/DeletePath/OperationEnd rows, device mapping and process/thread intervals while omitting unrelated paths; assertions pin exact 64-bit pointer identity, original birth attribution and explicit unknown outcomes.
 * @evidence contracts/testing.md#independent-expectations Authored provider rows, literal pointer values around 2^53, separate fractional UTC births and original scratch/drive mapping define the independent event relationships. No event supplies permission to infer missing-reader absence.
 * @evidence contracts/testing.md#distinguishing-cases Matching/unmatched births, exact pointers, null values, reused addresses/PIDs/TIDs, missing events and malformed/empty statuses differ. Both delivery orders of distinct issuers at Create/Cleanup/Close/SetDelete/Close-completion and old-IRP-end/new-request ties invalidate earlier rows too; regression remains unknown. Actual schema/recorder transport belongs to the cold Graph E2E scene.
 * @evidence contracts/testing.md#execution-ownership This source unit calls tests/utils portable correlation with authored data; it starts no native recorder, worker, compiler, process observer or installed consumer.
 */
export function test_windows_fileio_evidence_preserves_task_and_pointer_generations(): void {
  const at = (second: string) => `2026-10-14T00:00:${second}Z`;
  const event = (provider: "file" | "process", id: number, time: string, fields: Record<string, string>): WindowsFileIoEvidence.Event => ({ provider, id, version: 1, at: at(time), headerPid: 4, fields });
  const originalBirth = at("00.0000001");
  const task: WindowsFileIoEvidence.Task = {
    token: "actual-original-task", scratch: "Q:\\owned\\scratch", processes: [{ pid: 100, identity: originalBirth }],
    devices: [{ dos: "Q:", native: "\\Device\\VolumeObserved" }], loss: { eventsLost: 0, possibleWrap: false, decodingFailed: false },
  };
  const process = [
    event("process", 1, "00.1", { ProcessID: "100", CreateTime: originalBirth }),
    event("process", 3, "00.2", { ProcessID: "100", ThreadID: "900" }),
  ];
  const create = event("file", 12, "01", { FileObject: "0x20000000000001", Irp: "0x20000000000003", IssuingThreadId: "900", ShareAccess: "0x3", FileName: "\\Device\\VolumeObserved\\owned\\scratch\\source.go" });
  const rows = [
    ...process, create,
    event("file", 24, "01.1", { Irp: "9007199254740995", Status: "0x0" }),
    event("file", 12, "01.2", { FileObject: "0x20000000000000", Irp: "0x5", IssuingThreadId: "900", FileName: "Q:\\unrelated\\private.txt" }),
    event("file", 26, "02", { FileObject: "9007199254740993", Irp: "0x8", IssuingThreadId: "900", FilePath: "Q:\\owned\\scratch\\source.go", InfoClass: "13" }),
    event("file", 24, "02.1", { Irp: "8", Status: "0xc0000043" }),
  ];
  const selected = WindowsFileIoEvidence.select(rows, task);
  assert.equal(selected.selected.length, 4);
  assert.equal(selected.selected[0]!.event.fields.ShareAccess, "0x3");
  assert.deepEqual(selected.selected[0]!.owner, { certainty: "observed", pid: 100, birth: originalBirth, nativeThreadId: 900, threadStarted: at("00.2"), original: true });
  assert.equal(selected.selected[2]!.objectGeneration, selected.selected[0]!.objectGeneration);
  assert.equal(selected.selected[3]!.completion, "0xc0000043");
  assert.deepEqual(selected.selected[3]!.completionDecoded, { unsigned: "3221225539", ntSuccess: false });
  assert.equal(selected.readerAbsence, "not-established");
  assert.equal(JSON.stringify(selected).includes("private.txt"), false);
  assert.equal(selected.supportingProcessEvents.length, 2);
  const completedAfterExit = WindowsFileIoEvidence.select([
    ...process, create,
    event("process", 4, "01.05", { ProcessID: "100", ThreadID: "900" }),
    event("process", 2, "01.06", { ProcessID: "100", CreateTime: originalBirth }),
    event("file", 24, "01.1", { Irp: "9007199254740995", Status: "0x0" }),
  ], task);
  assert.equal((completedAfterExit.selected.at(-1)!.owner as { original: boolean }).original, true,
    "a completion belongs to the request's issuer generation even after that thread exits");

  const reused = WindowsFileIoEvidence.select([
    ...rows,
    event("process", 2, "03", { ProcessID: "100", CreateTime: originalBirth }),
    event("process", 1, "03.1", { ProcessID: "100", CreateTime: at("03.0000002") }),
    event("file", 18, "04", { FileObject: "0x20000000000001", Irp: "0x9", IssuingThreadId: "900", InfoClass: "13" }),
    event("file", 12, "05", { FileObject: "0x20000000000001", Irp: "0x9", FileName: "Q:\\other\\unrelated.txt" }),
    event("file", 24, "05.1", { Irp: "0x9", Status: "0x0" }),
  ], task);
  assert.equal((reused.selected.at(-1)!.owner as { certainty: string }).certainty, "unknown");
  assert.equal(reused.selected.at(-1)!.event.id, 18, "an unrelated reused IRP must not complete the old task request");
  assert.equal(JSON.stringify(reused).includes("unrelated.txt"), false);
  assert.equal(reused.completeness, "unknown");

  const missing = WindowsFileIoEvidence.select([
    event("file", 26, "01", { FileObject: "0xf", Irp: "0xa", IssuingThreadId: "901", FilePath: task.scratch, InfoClass: "13" }),
    event("file", 24, "01.1", { Irp: "0xa", Status: "malformed" }),
  ], { ...task, loss: { eventsLost: null, possibleWrap: true, decodingFailed: true } });
  assert.equal(missing.selected.length, 2);
  assert.equal(missing.selected[0]!.objectGeneration, null);
  assert.equal((missing.selected[0]!.owner as { certainty: string }).certainty, "unknown");
  assert.deepEqual(missing.selected[1]!.completionDecoded, { unsigned: null, ntSuccess: null });
  assert.equal(missing.completeness, "unknown");
  assert.equal(missing.readerAbsence, "not-established");
  assert.ok(missing.uncertainty.some((value) => value.includes("Lost-event")));
  assert.ok(WindowsFileIoEvidence.select(rows, { ...task, processes: [{ pid: 100, identity: at("00.0000002") }] }).selected.every((row) => !(row.owner as { original?: boolean } | null)?.original));
  assert.deepEqual(WindowsFileIoEvidence.select([], task).selected, []);
  const tied = WindowsFileIoEvidence.select([
    ...process,
    event("process", 4, "03", { ProcessID: "100", ThreadID: "900" }),
    event("process", 2, "03", { ProcessID: "100", CreateTime: originalBirth }),
    event("process", 1, "03", { ProcessID: "100", CreateTime: at("03.0000002") }),
    event("process", 3, "03", { ProcessID: "100", ThreadID: "900" }),
    { ...create, at: at("03") },
  ], task);
  assert.equal((tied.selected[0]!.owner as { certainty: string }).certainty, "unknown", "same native timestamps cannot order old/new issuing generations");
  const tiedPointers = WindowsFileIoEvidence.select([
    ...process, create,
    { ...create, fields: { ...create.fields, FileName: "Q:\\unrelated\\tied.txt", Irp: "0x10" } },
    event("file", 24, "02", { Irp: create.fields.Irp!, Status: "0x0" }),
  ], task);
  assert.ok(tiedPointers.selected.every((row) => row.objectGeneration === null && (row.owner as { certainty: string }).certainty === "unknown"));
  const tiedIrp = WindowsFileIoEvidence.select([...process, create,
    event("file", 24, "01", { Irp: create.fields.Irp!, Status: "0x0" }),
  ], task);
  assert.ok(tiedIrp.selected.every((row) => row.objectGeneration === null && (row.owner as { certainty: string }).certainty === "unknown"));
  const reversed = WindowsFileIoEvidence.select([...process, create,
    event("file", 24, "00.9", { Irp: create.fields.Irp!, Status: "0x0" }),
  ], task);
  assert.ok(reversed.selected.every((row) => row.objectGeneration === null && (row.owner as { certainty: string }).certainty === "unknown"));
  assert.equal(reversed.completeness, "unknown");
  const nullAddress = WindowsFileIoEvidence.select([...process,
    { ...create, fields: { ...create.fields, FileObject: "0x0" } },
    event("file", 24, "01.1", { Irp: create.fields.Irp!, Status: "" }),
  ], task);
  assert.equal(nullAddress.selected[0]!.objectGeneration, null);
  assert.deepEqual(nullAddress.selected[1]!.completionDecoded, { unsigned: null, ntSuccess: null });
  const externalBirth = at("00.0000003");
  const distinctIssuers = [...process,
    event("process", 1, "00.3", { ProcessID: "200", CreateTime: externalBirth }),
    event("process", 3, "00.4", { ProcessID: "200", ThreadID: "901" }),
  ];
  for (const id of [12, 13, 14, 18]) {
    const boundary = event("file", id, "02", { ...create.fields, Irp: "0x80", IssuingThreadId: "901" });
    const previous = event("file", 18, "02", { FileObject: create.fields.FileObject!, Irp: "0x81", IssuingThreadId: "900", InfoClass: "13" });
    for (const ordered of [[previous, boundary], [boundary, previous]]) {
      const result = WindowsFileIoEvidence.select([...distinctIssuers, create, ...ordered], task);
      assert.ok(result.selected.every((row) => row.objectGeneration === null && (row.owner as { certainty: string }).certainty === "unknown"),
        `FileObject lifecycle ${id} ties cannot select an issuer in either delivery order`);
    }
  }
  const oldCompletion = event("file", 24, "02", { Irp: create.fields.Irp!, Status: "0x0" });
  const newRequest = event("file", 18, "02", { FileObject: "0x20000000000001", Irp: create.fields.Irp!, IssuingThreadId: "901", InfoClass: "13" });
  for (const ordered of [[oldCompletion, newRequest], [newRequest, oldCompletion]]) {
    const result = WindowsFileIoEvidence.select([...distinctIssuers, create, ...ordered], task);
    assert.ok(result.selected.every((row) => row.objectGeneration === null && (row.owner as { certainty: string }).certainty === "unknown"),
      "an old completion and new IRP admission share no qualified delivery order");
  }
  const closeRequest = event("file", 14, "01.5", { FileObject: create.fields.FileObject!, Irp: "0x90", IssuingThreadId: "900" });
  const closeEnd = event("file", 24, "02", { Irp: "0x90", Status: "0x0" });
  for (const ordered of [[closeEnd, newRequest], [newRequest, closeEnd]]) {
    const result = WindowsFileIoEvidence.select([...distinctIssuers, create, closeRequest, ...ordered], task);
    assert.ok(result.selected.every((row) => row.objectGeneration === null && (row.owner as { certainty: string }).certainty === "unknown"),
      "successful Close completion cannot order a same-time FileObject operation");
  }
  const threadEnd = event("process", 4, "03", { ProcessID: "100", ThreadID: "900" });
  const threadBegin = event("process", 3, "03", { ProcessID: "200", ThreadID: "900" });
  for (const ordered of [[threadEnd, threadBegin], [threadBegin, threadEnd]]) {
    const result = WindowsFileIoEvidence.select([...distinctIssuers, create, ...ordered,
      { ...newRequest, at: at("03.1"), fields: { ...newRequest.fields, IssuingThreadId: "900" } },
    ], task);
    assert.ok(result.selected.every((row) => row.objectGeneration === null && (row.owner as { certainty: string }).certainty === "unknown"),
      "tied TID retirement/reuse cannot certify earlier or later issuer rows");
  }
}
