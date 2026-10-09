import { RuntimeDescendantController, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies authenticated descendant transitions preserve original-target authority.
 *
 * 1. Admit held parents/children through the actual shared operation and require
 *    enrollment before acquisition acknowledgments.
 * 2. Reject foreign, duplicate and out-of-phase frames; distinguish lazy result,
 *    abrupt abandonment and connection loss from kernel retirement.
 * 3. Interleave role admissions and prove observer requests remain serialized;
 *    retain acquisition and cleanup failures independently. Exercise the shared
 *    async launcher with one real Node child and an absent executable.
 *
 * @evidence contracts/testing.md#behavioral-verification Public controller receive/request/settle/snapshot/close and transportError operations process actual authored frames, transport failures and supplied observer responses. Assertions inspect emitted commands, result/error payloads, request order, original-target waits and unresolved-close failures. Concurrent held cleanup emits one abort; released cleanup emits none; protocol failure preserves admitted targets and later actual retirement without manufacturing semantic success. Prepared parent death distinguishes an already-retired original child from a surviving child requiring one self-kill, preserves raw transport causes and still refuses unknown retirement.
 * @evidence contracts/testing.md#independent-expectations Literal protocol phases and authored kernel responses distinguish admission, release and departure. Explicit pending promises independently expose overlapping requests; a transport close is deliberately followed by a live original target.
 * @evidence contracts/testing.md#distinguishing-cases Covers normal lazy completion, structured lazy error, self-abandonment without completion, foreign nonce/role/transport, invalid PID, duplicate role/completion, premature completion, acquisition refusal, connection loss, concurrent admissions across roles and an authenticated final frame during close while new requests/enrollment and post-close frames remain refused. Cleanup contrasts held with released, duplicate strict release/abort and live refusal, missing normal completion, independently retired failed transport and close during admitted cleanup. Parent-death intent contrasts live/dead originals, earlier and in-flight unsolicited failure, duplicate/out-of-phase requests, coupled versus surviving child departure, transport failure during self-kill dispatch, unknown observer response and close overlapping one admitted abandonment.
 * @evidence contracts/testing.md#execution-ownership Existing test-ttsc utility discovery owns this export, importing public @ttsc/testing only. Controller callbacks start no socket or native observer. Launcher cases start one plain Node child and one failing executable attempt, with no compiler, Go build or installation; real descendant transport/kernel proofs remain Runtime E2E.
 */
export async function test_runtime_descendant_controller_authenticates_and_joins(): Promise<void> {
  const failures: unknown[] = [];
  const check = async (name: string, run: () => Promise<void>): Promise<void> => {
    try { await run(); }
    catch (cause) { failures.push(new Error(name, { cause })); }
  };
  const fixture = (roles = ["child"]) => {
    const retired = new Set<number>();
    const calls: string[] = [];
    const observer = {
      sessionNonce: "native-session",
      async acquire(pid: number) {
        calls.push("acquire:" + pid);
        return { sessionNonce: "native-session", targetId: "original-" + pid,
          pid, identity: { kernel: "authored-portable-response" } };
      },
      async retired(target: { targetId: string; pid: number }) {
        calls.push("wait:" + target.targetId);
        return retired.has(target.pid);
      },
    };
    const controller = RuntimeDescendantController.create(observer, roles);
    const sent: Record<string, unknown>[] = [];
    const transport = { send: (row: Record<string, unknown>) => { sent.push(row); }, close() {} };
    const announce = (role = "child", pid = 12, parentPid = 11) => ({
      version: 1, nonce: controller.nonce, role, event: "announce", pid, parentPid,
    });
    const complete = (extra: Record<string, unknown> = {}) => ({
      version: 1, nonce: controller.nonce, role: "child", event: "complete",
      pid: 12, value: "literal-lazy-result", ...extra,
    });
    return { controller, observer, transport, announce, complete, retired, calls, sent };
  };
  await check("normal original-target admission, lazy result and join", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    assert.deepEqual(f.calls, ["acquire:11", "acquire:12"]);
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0]!.event, "acquired");
    assert.equal((f.sent[0]!.target as { targetId: string }).targetId, "original-12");
    assert.deepEqual(await f.controller.request("child", "live"), {
      target: { sessionNonce: "native-session", targetId: "original-12", pid: 12,
        identity: { kernel: "authored-portable-response" } }, live: true,
    });
    f.retired.add(11);
    await f.controller.request("child", "parent-joined");
    const released = await f.controller.request("child", "release") as { operation: string };
    assert.equal(released.operation, "release");
    assert.equal(f.sent[1]!.operation, "release");
    await f.controller.receive(f.complete(), f.transport);
    f.retired.add(12);
    const joined = await f.controller.request("child", "joined") as any;
    assert.equal(joined.retired, true);
    assert.equal(joined.completion.value, "literal-lazy-result");
    f.controller.disconnected(f.transport);
    await f.controller.close();
    assert.equal(f.controller.joined(), true);
  });
  await check("foreign and malformed admission cannot enroll a target", async () => {
    const f = fixture();
    for (const frame of [null, { ...f.announce(), nonce: "foreign" },
      { ...f.announce(), role: "foreign" }, { ...f.announce(), pid: 0 },
      { ...f.announce(), parentPid: 12 }])
      await assert.rejects(f.controller.receive(frame, f.transport));
    assert.deepEqual(f.calls, []);
    await f.controller.close();
  });
  await check("duplicates and wrong-phase completion are refused", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    await assert.rejects(f.controller.receive(f.announce(), f.transport), /Duplicate/);
    await assert.rejects(f.controller.receive(f.complete(), f.transport), /phase/);
    await f.controller.request("child", "release");
    await assert.rejects(f.controller.receive(f.complete(), { ...f.transport }), /transport/);
    await f.controller.receive(f.complete(), f.transport);
    await assert.rejects(f.controller.receive(f.complete(), f.transport), /phase/);
    await assert.rejects(f.controller.request("child", "release"), /already released/);
    f.retired.add(11); f.retired.add(12);
    await f.controller.request("child", "joined");
    await f.controller.close();
  });
  await check("lazy error remains data after independently proven departure", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    await f.controller.request("child", "release");
    await f.controller.receive(f.complete({ error: { message: "authored lazy refusal" } }), f.transport);
    f.retired.add(11); f.retired.add(12);
    const joined = await f.controller.request("child", "joined") as any;
    assert.equal(joined.retired, true);
    assert.deepEqual(joined.completion.error, { message: "authored lazy refusal" });
    await f.controller.close();
  });
  await check("abandonment has no completion but still needs original departure", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    f.retired.add(11);
    await f.controller.request("child", "parent-joined");
    await f.controller.request("child", "abandon");
    assert.equal(f.sent[1]!.operation, "abandon");
    f.controller.disconnected(f.transport);
    // Connection closure cannot turn this still-live kernel target into joined.
    await assert.rejects(f.controller.close(), /controller closure/);
    assert.equal(f.controller.joined(), false);
  });
  await check("completed abrupt abandonment requires no forged result", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    f.retired.add(11);
    await f.controller.request("child", "parent-joined");
    await f.controller.request("child", "abandon");
    f.retired.add(12);
    const joined = await f.controller.request("child", "joined") as any;
    assert.equal(joined.completion, null);
    await f.controller.close();
  });
  await check("prepared parent death can retire the original child without another command", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    const prepared = await f.controller.request("child", "prepare-abandon") as any;
    assert.equal(prepared.prepared, true);
    assert.equal(f.controller.snapshot()[0]!.phase, "abandoning");
    assert.equal(f.sent.length, 1, "preparing intent must not kill the child before its parent");
    f.controller.transportError(f.transport, new Error("authored abrupt reset"));
    f.controller.disconnected(f.transport);
    f.retired.add(11); f.retired.add(12);
    const abandoned = await f.controller.request("child", "abandon") as any;
    assert.equal(abandoned.alreadyRetired, true);
    assert.equal(f.sent.length, 1, "an original already retired cannot receive self-kill");
    const joined = await f.controller.request("child", "joined") as any;
    assert.equal(joined.completion, null);
    const receipt = f.controller.snapshot()[0]!;
    assert.equal(receipt.parentRetired, true);
    assert.equal(receipt.childRetired, true);
    assert.deepEqual(receipt.errors, []);
    assert.deepEqual(receipt.transportErrors, ["Error: authored abrupt reset"]);
    await f.controller.close();
  });
  await check("prepared surviving child receives one authenticated self-kill after parent retirement", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    await f.controller.request("child", "prepare-abandon");
    await assert.rejects(f.controller.request("child", "prepare-abandon"), /not held/);
    await assert.rejects(f.controller.request("child", "live"), /not held/);
    await assert.rejects(f.controller.request("child", "release"), /already released/);
    await assert.rejects(f.controller.receive(f.complete(), f.transport), /phase/);
    f.retired.add(11);
    const abandoned = await f.controller.request("child", "abandon") as any;
    assert.equal(abandoned.alreadyRetired, false);
    assert.deepEqual(f.sent.map((row) => row.operation).filter(Boolean), ["abandon"]);
    assert.equal(f.controller.snapshot()[0]!.parentRetired, true);
    assert.equal(f.controller.snapshot()[0]!.childRetired, false);
    await assert.rejects(f.controller.request("child", "abandon"), /already released/);
    await assert.rejects(f.controller.request("child", "abort"), /already released/);
    f.controller.transportError(f.transport, new Error("authored self-kill reset"));
    f.controller.disconnected(f.transport);
    f.retired.add(12);
    const receipt = await f.controller.settle("child");
    assert.equal(receipt.completion, null);
    assert.deepEqual(receipt.errors, []);
    assert.deepEqual(receipt.transportErrors, ["Error: authored self-kill reset"]);
    assert.deepEqual(f.sent.map((row) => row.operation).filter(Boolean), ["abandon"]);
    await f.controller.close();
  });
  await check("abrupt intent cannot turn connection closure into native retirement", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    await f.controller.request("child", "prepare-abandon");
    f.controller.transportError(f.transport, new Error("authored reset with unknown original"));
    f.controller.disconnected(f.transport);
    f.retired.add(11);
    await f.controller.request("child", "abandon");
    await assert.rejects(f.controller.close(), /controller closure/);
    assert.equal(f.controller.joined(), false);
    assert.equal(f.controller.snapshot()[0]!.childRetired, false);
  });
  await check("child retirement racing self-kill dispatch retains the actual transport cause", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    await f.controller.request("child", "prepare-abandon");
    f.retired.add(11);
    f.transport.send = (row) => {
      f.sent.push(row);
      f.retired.add(12);
      throw new Error("authored transport write refusal");
    };
    const abandoned = await f.controller.request("child", "abandon") as any;
    assert.equal(abandoned.alreadyRetired, false);
    f.controller.disconnected(f.transport);
    const joined = await f.controller.request("child", "joined") as any;
    assert.equal(joined.retired, true);
    assert.deepEqual(f.controller.snapshot()[0]!.transportErrors, ["Error: authored transport write refusal"]);
    assert.deepEqual(f.controller.snapshot()[0]!.errors, []);
    assert.deepEqual(f.sent.map((row) => row.operation).filter(Boolean), ["abandon"]);
    await f.controller.close();
  });
  await check("unknown observer retirement remains a failure after abrupt intent", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    await f.controller.request("child", "prepare-abandon");
    f.observer.retired = async () => { throw new Error("authored original wait refusal"); };
    await assert.rejects(f.controller.request("child", "abandon"), /wait refusal/);
    await assert.rejects(f.controller.close(), /controller closure/);
    assert.equal(f.controller.joined(), false);
    assert.equal(f.controller.snapshot()[0]!.parent!.targetId, "original-11");
    assert.equal(f.controller.snapshot()[0]!.target!.targetId, "original-12");
  });
  await check("preparation refuses dead originals and cannot erase an earlier failure", async () => {
    for (const dead of [11, 12]) {
      const f = fixture();
      await f.controller.receive(f.announce(), f.transport);
      f.retired.add(dead);
      await assert.rejects(f.controller.request("child", "prepare-abandon"), /live original/);
      assert.equal(f.sent.length, 1);
      f.retired.add(11); f.retired.add(12);
      const receipt = await f.controller.settle("child");
      assert.match(receipt.errors[0]!, /live original/);
      await assert.rejects(f.controller.close(), /controller closure/);
    }
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    f.controller.transportError(f.transport, new Error("authored unsolicited transport failure"));
    f.controller.disconnected(f.transport);
    await assert.rejects(f.controller.request("child", "prepare-abandon"), /unsolicited/);
    f.retired.add(11); f.retired.add(12);
    const receipt = await f.controller.settle("child");
    assert.match(receipt.errors[0]!, /unsolicited/);
    assert.deepEqual(receipt.transportErrors, ["Error: authored unsolicited transport failure"]);
    await assert.rejects(f.controller.close(), /controller closure/);
  });
  await check("a disconnect during native admission checks is not retrospective intent", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    f.observer.retired = async (target) => {
      f.calls.push("wait:" + target.targetId);
      f.controller.disconnected(f.transport);
      await Promise.resolve();
      return f.retired.has(target.pid);
    };
    await assert.rejects(f.controller.request("child", "prepare-abandon"), /connection ended/);
    assert.equal(f.controller.snapshot()[0]!.phase, "preparing-abandon");
    f.retired.add(11); f.retired.add(12);
    const receipt = await f.controller.settle("child");
    assert.match(receipt.errors[0]!, /connection ended/);
    await assert.rejects(f.controller.close(), /controller closure/);
  });
  await check("close drains admitted abandonment and cleanup shares its one command", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    await f.controller.request("child", "prepare-abandon");
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const waiting = new Promise<void>((resolve) => { entered = resolve; });
    f.observer.retired = async (target) => {
      f.calls.push("wait:" + target.targetId);
      if (target.pid === 11) { entered(); await gate; }
      return f.retired.has(target.pid);
    };
    const abandoning = f.controller.request("child", "abandon");
    const settling = f.controller.settle("child");
    await waiting;
    assert.equal(f.sent.length, 1, "the child command waits for original parent retirement");
    const closing = f.controller.close();
    f.retired.add(11); f.retired.add(12);
    release();
    await abandoning; await settling; await closing;
    assert.equal(f.sent.length, 1);
    assert.equal(f.controller.joined(), true);
  });
  await check("premature EOF remains a failure even when the target later retires", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    f.controller.disconnected(f.transport);
    await assert.rejects(f.controller.request("child", "live"), /connection ended/);
    f.retired.add(11); f.retired.add(12);
    await assert.rejects(f.controller.close(), /controller closure/);
    assert.equal(f.controller.joined(), true);
  });
  await check("abort retains the original connection failure while joining cleanup", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    f.controller.disconnected(f.transport);
    await f.controller.request("child", "abort");
    assert.equal(f.sent[1]!.operation, "abort");
    f.retired.add(11); f.retired.add(12);
    await assert.rejects(f.controller.request("child", "joined"), /connection ended/);
    await assert.rejects(f.controller.close(), /controller closure/);
    assert.equal(f.controller.joined(), true);
  });
  await check("concurrent roles never overlap native observer requests", async () => {
    let release!: () => void;
    let entered!: () => void;
    const firstEntered = new Promise<void>((resolve) => { entered = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const calls: string[] = [];
    let active = 0;
    let maximum = 0;
    const observer = {
      sessionNonce: "serialized",
      async acquire(pid: number) {
        active++; maximum = Math.max(maximum, active); calls.push("acquire:" + pid);
        if (pid === 11) { entered(); await gate; }
        active--;
        return { sessionNonce: "serialized", targetId: "target-" + pid, pid, identity: {} };
      },
      async retired(target: { pid: number }) {
        active++; maximum = Math.max(maximum, active); calls.push("wait:" + target.pid);
        await Promise.resolve(); active--; return true;
      },
    };
    const c = RuntimeDescendantController.create(observer, ["a", "b"]);
    const transport = { send() {}, close() {} };
    const first = c.receive({ version: 1, nonce: c.nonce, role: "a", event: "announce", pid: 12, parentPid: 11 }, transport);
    const second = c.receive({ version: 1, nonce: c.nonce, role: "b", event: "announce", pid: 22, parentPid: 21 }, { ...transport });
    try { await firstEntered; assert.deepEqual(calls, ["acquire:11"]); }
    finally { release(); await first; await second; }
    const a = c.request("a", "parent-joined");
    const b = c.request("b", "parent-joined");
    await a; await b;
    assert.equal(maximum, 1);
    await c.request("a", "abandon");
    await c.request("b", "abandon");
    await c.close();
    assert.equal(maximum, 1);
  });
  await check("acquisition failure does not manufacture a target or hide close errors", async () => {
    const failure = new Error("authored acquisition refusal");
    const c = RuntimeDescendantController.create({
      sessionNonce: "refused",
      async acquire() { throw failure; },
      async retired() { assert.fail("no original target was acquired"); },
    }, ["child"]);
    const sent: unknown[] = [];
    await assert.rejects(c.receive({ version: 1, nonce: c.nonce, role: "child", event: "announce", pid: 12, parentPid: 11 }, { send: (row) => { sent.push(row); }, close() {} }), (error) => error === failure);
    assert.deepEqual(sent, []);
    await assert.rejects(c.close(), (error: unknown) => error instanceof AggregateError && error.errors.includes(failure));
    assert.equal(c.joined(), false);
  });
  await check("final completion frames drain after independent kernel departure", async () => {
    const f = fixture();
    let settle!: () => void;
    const transport = { ...f.transport,
      settled: new Promise<void>((resolve) => { settle = resolve; }) };
    await f.controller.receive(f.announce(), transport);
    await f.controller.request("child", "release");
    f.retired.add(11); f.retired.add(12);
    const joining = f.controller.request("child", "joined");
    await f.controller.receive(f.complete(), transport);
    settle();
    assert.equal((await joining as any).completion.value, "literal-lazy-result");
    await f.controller.close();
  });
  await check("close drains owned completion while refusing new admission and requests", async () => {
    const f = fixture(["child", "new-child"]);
    let settle!: () => void;
    const transport = { ...f.transport,
      settled: new Promise<void>((resolve) => { settle = resolve; }) };
    await f.controller.receive(f.announce(), transport);
    await f.controller.request("child", "release");
    f.retired.add(11); f.retired.add(12);
    const closing = f.controller.close();
    // Keep final transport processing held while close checks original targets.
    // No clock or socket event stands in for independent kernel retirement.
    try {
      await assert.rejects(f.controller.receive(f.announce("new-child", 22, 21), transport), /closing/);
      await assert.rejects(f.controller.request("child", "ready"), /closing/);
      await assert.rejects(f.controller.receive(f.complete(), { ...transport }), /transport/);
      await f.controller.receive(f.complete(), transport);
    } finally { settle(); }
    await closing;
    assert.equal(f.controller.joined(), true);
    await assert.rejects(f.controller.receive(f.complete(), transport), /Foreign/);
  });
  await check("cleanup atomically aborts a held role once and preserves strict requests", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    f.retired.add(11); f.retired.add(12);
    const first = f.controller.settle("child");
    const second = f.controller.settle("child");
    const a = await first;
    const b = await second;
    assert.deepEqual(f.sent.map((row) => row.operation).filter(Boolean), ["abort"]);
    assert.equal(a.childRetired, true);
    assert.equal(b.parentRetired, true);
    assert.equal(a.completion, null);
    assert.deepEqual(a.errors, []);
    await assert.rejects(f.controller.request("child", "abort"), /already released/);
    await assert.rejects(f.controller.request("child", "release"), /already released/);
    await assert.rejects(f.controller.request("child", "live"), /not held/);
    await f.controller.close();
  });
  await check("cleanup joins released completion without issuing another command", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    await f.controller.request("child", "release");
    await f.controller.receive(f.complete(), f.transport);
    f.retired.add(11); f.retired.add(12);
    const result = await f.controller.settle("child");
    assert.deepEqual(f.sent.map((row) => row.operation).filter(Boolean), ["release"]);
    assert.equal(result.completion!.value, "literal-lazy-result");
    assert.deepEqual(result.errors, []);
    await f.controller.close();
  });
  await check("admission and native retirement survive a premature connection failure", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    f.controller.disconnected(f.transport);
    const admission = f.controller.snapshot()[0]!;
    assert.equal(admission.target!.pid, 12);
    assert.equal(admission.parent!.pid, 11);
    assert.equal(admission.childRetired, false);
    assert.match(admission.errors[0]!, /connection ended/);
    f.retired.add(11); f.retired.add(12);
    const result = await f.controller.settle("child");
    assert.equal(result.childRetired, true);
    assert.equal(result.parentRetired, true);
    assert.match(result.errors[0]!, /connection ended/);
    assert.equal(result.completion, null);
    await assert.rejects(f.controller.close(), /controller closure/);
    assert.equal(f.controller.joined(), true);
  });
  await check("released departure without completion remains a semantic failure", async () => {
    const f = fixture();
    await f.controller.receive(f.announce(), f.transport);
    await f.controller.request("child", "release");
    f.retired.add(11); f.retired.add(12);
    const result = await f.controller.settle("child");
    assert.equal(result.childRetired, true);
    assert.equal(result.parentRetired, true);
    assert.match(result.errors[0]!, /without lazy completion/);
    assert.equal(f.sent.length, 2);
    await assert.rejects(f.controller.close(), /controller closure/);
  });
  await check("close drains an admitted cleanup while refusing new cleanup", async () => {
    const f = fixture();
    let drain!: () => void;
    const transport = { ...f.transport, settled: new Promise<void>((resolve) => { drain = resolve; }) };
    await f.controller.receive(f.announce(), transport);
    f.retired.add(11); f.retired.add(12);
    const settling = f.controller.settle("child");
    const closing = f.controller.close();
    await assert.rejects(f.controller.settle("child"), /closing/);
    drain();
    assert.equal((await settling).childRetired, true);
    await closing;
  });
  await check("async launcher captures actual input, environment, streams and status", async () => {
    const bytes = Buffer.from("prefix:literal-\u03bb-input:suffix");
    const input = bytes.subarray(Buffer.byteLength("prefix:"), -Buffer.byteLength(":suffix"));
    const result = await TestProject.spawnAsync(process.execPath, ["-e", [
      "let input='';process.stdin.setEncoding('utf8');",
      "process.stdin.on('data',part=>input+=part);",
      "process.stdin.on('end',()=>{",
      "process.stdout.write(JSON.stringify({input,selected:process.env.TTSC_BINARY,",
      "cache:process.env.GOCACHE,tsgo:process.env.TTSC_TSGO_BINARY}));",
      "process.stderr.write('literal-stderr');process.exitCode=7;});",
    ].join("")], {
      input, env: { TTSC_BINARY: "authored-selected-binary", GOCACHE: "authored-cache" },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 7);
    assert.equal(result.signal, null);
    assert.ok(result.pid > 0);
    assert.deepEqual(JSON.parse(result.stdout), {
      input: "literal-\u03bb-input", selected: "authored-selected-binary",
      cache: "authored-cache", tsgo: TestProject.TSGO_BINARY,
    });
    assert.equal(result.stderr, "literal-stderr");
    assert.deepEqual(result.output, [null, result.stdout, "literal-stderr"]);
  });
  await check("async launch failure retains original error and actual close", async () => {
    const root = TestProject.tmpdir("ttsc-async-launch-unit-");
    const result = await TestProject.spawnAsync(path.join(root, "missing-executable"), []);
    assert.equal((result.error as NodeJS.ErrnoException).code, "ENOENT");
    assert.equal(result.signal, null);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, result.error!.message);
  });
  if (failures.length) throw new AggregateError(failures, "Descendant controller portable failures");
}
