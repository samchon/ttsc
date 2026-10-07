import assert from "node:assert/strict";

import type { ResidentReplyKind } from "../../../../../packages/ttsc/src/compiler/internal/ResidentReplyKind";
import { ResidentTransformRequests } from "../../../../../packages/ttsc/src/compiler/internal/ResidentTransformRequests";

/**
 * Verifies resident reply slots preserve FIFO and terminal settlement
 * ownership.
 *
 * Actual Promise callbacks and AbortSignals observe the production-used state
 * owner. Supplied framed lines are inputs, not a peer or native pipe receipt.
 *
 * 1. Admit ordered positive, negative and wrong-operation replies.
 * 2. Retire malformed and unsolicited streams with exact failure identity.
 * 3. Settle once, drain slots and remove their standard abort listeners.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual add/current/accept/settle/retire and awaits real Promise outcomes. Exact FIFO owners, payloads, errors, terminal transition booleans, callback counts and listener removal are observed without accessing private queue storage.
 * @evidence contracts/testing.md#independent-expectations Literal reply records and contract error messages define outcomes; explicit expected callback order and the supplied Error identity require exactly-once settlement and terminal state before rejection callbacks, independently of private queue implementation.
 * @evidence contracts/testing.md#distinguishing-cases Blank lines preserve a slot, transform/update negatives are valid, wrong-operation shape rejects only the current slot, malformed input rejects all live slots with one error, unsolicited input preserves the first failure, duplicate settlement does not call twice, five sequential slots exercise head advancement, and later aborts cannot invoke removed listeners after settlement/retirement. A live abort invokes only the supplied callback; native cancellation policy is not inferred.
 * @evidence contracts/testing.md#execution-ownership One asynchronous matching source unit directly invokes the production-used class with no constructor seam, peer, child, compiler, installation, host or stream replacement. It certifies no chunk framing, native writes, AbortError/stderr policy, disposal/exit lifetime or public fast-failure admission. Authored body, selection and runtime are separate; this body is unexecuted.
 */
export async function test_resident_transform_requests_preserves_fifo_and_terminal_slots(): Promise<void> {
  const failures: Error[] = [];
  const check = async (
    name: string,
    operation: () => Promise<void>,
  ): Promise<void> => {
    try {
      await operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const slot = (
    core: ResidentTransformRequests,
    kind: ResidentReplyKind,
    events: string[],
    name: string,
    signal?: AbortSignal,
  ) => {
    let calls = 0;
    const pendingAndPromise: {
      pending?: ReturnType<ResidentTransformRequests["add"]>;
    } = {};
    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      pendingAndPromise.pending = core.add(
        kind,
        (value) => {
          ++calls;
          events.push(`resolve:${name}`);
          resolve(value);
        },
        (error) => {
          ++calls;
          events.push(`reject:${name}`);
          reject(error);
        },
        signal,
        () => events.push(`abort:${name}`),
      );
    });
    const result = promise.then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error: unknown) => ({ status: "rejected" as const, error }),
    );
    assert.ok(pendingAndPromise.pending);
    return { pending: pendingAndPromise.pending, result, calls: () => calls };
  };
  await check("FIFO positives and negatives", async () => {
    const core = new ResidentTransformRequests();
    const events: string[] = [];
    const first = slot(core, "transform", events, "first");
    const second = slot(core, "transform", events, "second");
    const third = slot(core, "update", events, "third");
    assert.equal(core.current(), first.pending);
    assert.equal(core.accept(" \t\r\n "), false);
    assert.equal(core.current(), first.pending);
    assert.equal(
      core.accept(' {"found":true,"typescript":"","extra":7} '),
      false,
    );
    assert.equal(core.current(), second.pending);
    assert.equal(core.accept('{"found":false,"typescript":42}'), false);
    assert.equal(core.current(), third.pending);
    assert.equal(core.accept('{"updated":false}'), false);
    assert.equal(core.current(), undefined);
    assert.equal(core.failure, undefined);
    assert.deepEqual(
      await Promise.all([first.result, second.result, third.result]),
      [
        {
          status: "fulfilled",
          value: { found: true, typescript: "", extra: 7 },
        },
        { status: "fulfilled", value: { found: false, typescript: 42 } },
        { status: "fulfilled", value: { updated: false } },
      ],
    );
    assert.deepEqual(events, [
      "resolve:first",
      "resolve:second",
      "resolve:third",
    ]);
  });
  await check("wrong shape consumes only its owner", async () => {
    const core = new ResidentTransformRequests();
    const events: string[] = [];
    const first = slot(core, "transform", events, "wrong");
    const next = slot(core, "update", events, "next");
    assert.equal(core.accept('{"updated":true}'), false);
    const rejected = await first.result;
    assert.equal(rejected.status, "rejected");
    if (rejected.status === "rejected") {
      assert.ok(rejected.error instanceof Error);
      assert.equal(
        rejected.error.message,
        'ttsc: resident transform host sent an invalid transform reply: {"updated":true}',
      );
    }
    assert.equal(core.failure, undefined);
    assert.equal(core.current(), next.pending);
    assert.equal(core.accept('{"updated":true}'), false);
    assert.deepEqual(await next.result, {
      status: "fulfilled",
      value: { updated: true },
    });
    assert.deepEqual(events, ["reject:wrong", "resolve:next"]);
  });
  await check("malformed retires all outstanding slots", async () => {
    const core = new ResidentTransformRequests();
    const events: string[] = [];
    const first = slot(core, "transform", events, "first");
    const second = slot(core, "update", events, "second");
    assert.equal(core.accept("{not json"), true);
    const terminal = core.failure;
    assert.ok(terminal instanceof Error);
    assert.equal(
      terminal.message,
      "ttsc: resident transform host sent a malformed reply: {not json",
    );
    for (const result of await Promise.all([first.result, second.result])) {
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") assert.equal(result.error, terminal);
    }
    assert.equal(core.current(), undefined);
    assert.equal(core.accept('{"updated":true}'), false);
    assert.equal(core.accept("another malformed line"), false);
    assert.equal(core.retire(new Error("later")), false);
    assert.equal(core.failure, terminal);
    assert.deepEqual(events, ["reject:first", "reject:second"]);
    assert.equal(first.calls(), 1);
    assert.equal(second.calls(), 1);
  });
  await check("unsolicited first failure", async () => {
    const core = new ResidentTransformRequests();
    assert.equal(core.accept("   "), false);
    assert.equal(core.failure, undefined);
    assert.equal(core.accept('{"found":false}'), true);
    const terminal = core.failure;
    assert.ok(terminal instanceof Error);
    assert.equal(
      terminal.message,
      "ttsc: resident transform host sent an unsolicited reply",
    );
    assert.equal(core.accept('{"found":false}'), false);
    assert.equal(core.retire(new Error("replacement")), false);
    assert.equal(core.failure, terminal);
  });
  await check("once settlement and head advancement", async () => {
    const core = new ResidentTransformRequests();
    const events: string[] = [];
    const controllers = Array.from({ length: 5 }, () => new AbortController());
    const slots = controllers.map((controller, index) =>
      slot(core, "update", events, String(index), controller.signal),
    );
    for (const [index, current] of slots.entries()) {
      assert.equal(core.current(), current.pending);
      const reply = { updated: true, index };
      core.settle(current.pending, reply);
      core.settle(current.pending, new Error("duplicate must not reject"));
      assert.deepEqual(await current.result, {
        status: "fulfilled",
        value: reply,
      });
      assert.equal(current.calls(), 1);
      assert.equal(current.pending.settled, true);
      controllers[index]!.abort();
    }
    assert.equal(core.current(), undefined);
    assert.deepEqual(events, [
      "resolve:0",
      "resolve:1",
      "resolve:2",
      "resolve:3",
      "resolve:4",
    ]);
  });
  await check(
    "retirement state precedes callbacks and removes listeners",
    async () => {
      const core = new ResidentTransformRequests();
      const terminal = new Error("authored retirement");
      const controllers = [new AbortController(), new AbortController()];
      const observed: unknown[] = [];
      const promises = controllers.map((controller, index) =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          core.add(
            "update",
            resolve,
            (error) => {
              observed.push([index, core.failure, core.current()]);
              reject(error);
            },
            controller.signal,
            () => observed.push("unexpected abort"),
          );
        }).then(
          (value) => value,
          (error: unknown) => error,
        ),
      );
      assert.equal(core.retire(terminal), true);
      assert.equal(core.retire(new Error("later")), false);
      assert.deepEqual(await Promise.all(promises), [terminal, terminal]);
      for (const controller of controllers) controller.abort();
      assert.deepEqual(observed, [
        [0, terminal, undefined],
        [1, terminal, undefined],
      ]);
      assert.equal(core.failure, terminal);
    },
  );
  await check("live abort invokes only the supplied observation", async () => {
    const core = new ResidentTransformRequests();
    const events: string[] = [];
    const controller = new AbortController();
    const current = slot(core, "update", events, "live", controller.signal);
    controller.abort();
    assert.deepEqual(events, ["abort:live"]);
    assert.equal(current.pending.settled, false);
    assert.equal(core.current(), current.pending);
    const failure = new Error("supplied settlement, not native AbortError");
    core.settle(current.pending, failure);
    assert.deepEqual(await current.result, {
      status: "rejected",
      error: failure,
    });
    assert.equal(current.calls(), 1);
  });
  if (failures.length !== 0)
    throw new AggregateError(failures, "resident FIFO/terminal slot policy");
}
