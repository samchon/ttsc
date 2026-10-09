import { TestExecutor } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ordered phase execution without conflating failure with dependency.
 *
 * An unrelated assertion must not suppress a safe independent control, while
 * failed closure or restoration must still forbid a dependent borrower.
 *
 * 1. Execute real failing and successful callbacks and retain their order and errors.
 * 2. Hold an asynchronous operation and concurrent closes until their own joins.
 * 3. Fail independent restorations and require explicit non-entry of unsafe work.
 *
 * @evidence contracts/testing.md#behavioral-verification Real callbacks record entry, awaited completion, cleanup attempts and actual thrown values through the public shared collector; blocked callbacks must never run.
 * @evidence contracts/testing.md#independent-expectations Literal operation orders, authored failure objects and independently released promises establish expected execution and settlement without reading implementation structure.
 * @evidence contracts/testing.md#distinguishing-cases Empty work, independent continuation, explicit blocked prerequisites, synchronous undefined throws, asynchronous rejection, concurrent close attempts, multiple failed restorations and successful fresh work distinguish unavailable authority from unrelated failures.
 * @evidence contracts/testing.md#execution-ownership The existing test-ttsc unit runner owns this export. Callback-only controls create no child, compiler, native host, installer, timer or private cross-suite import.
 */
export async function test_test_executor_collects_independent_phases(): Promise<void> {
  const failures: unknown[] = [];
  const check = async (name: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  await check("empty population", async () => {
    assert.deepEqual(await TestExecutor.collectPhases([]), []);
  });
  await check("independent work follows sync and async failures", async () => {
    const order: string[] = [];
    const first = new Error("authored first failure");
    const second = { message: "authored async failure" };
    const outcomes = await TestExecutor.collectPhases([
      {
        name: "first assertion",
        run: () => {
          order.push("first");
          throw first;
        },
      },
      {
        name: "second assertion",
        run: async () => {
          order.push("second");
          throw second;
        },
      },
      { name: "independent final control", run: () => order.push("final") },
    ]);
    assert.deepEqual(order, ["first", "second", "final"]);
    assert.deepEqual(outcomes, [
      { name: "first assertion", status: "failed", error: first },
      { name: "second assertion", status: "failed", error: second },
      { name: "independent final control", status: "returned" },
    ]);
    assert.equal(outcomes[0]!.status === "failed" && outcomes[0]!.error, first);
    assert.equal(outcomes[1]!.status === "failed" && outcomes[1]!.error, second);
  });
  await check("explicit prerequisites forbid entry without erasing failures", async () => {
    const reasons = ["first resident closure unresolved", "source restore failed"];
    const failure = new Error("unrelated assertion");
    const order: string[] = [];
    const outcomes = await TestExecutor.collectPhases([
      {
        name: "assertion",
        run: () => {
          throw failure;
        },
      },
      {
        name: "fresh resident",
        blockedBy: reasons,
        run: () => assert.fail("an unsafe borrower was admitted"),
      },
      { name: "independent retention", run: () => order.push("retained") },
    ]);
    reasons.push("later caller mutation");
    assert.deepEqual(order, ["retained"]);
    assert.deepEqual(outcomes, [
      { name: "assertion", status: "failed", error: failure },
      {
        name: "fresh resident",
        status: "blocked",
        blockedBy: ["first resident closure unresolved", "source restore failed"],
      },
      { name: "independent retention", status: "returned" },
    ]);
  });
  await check("ordered execution awaits real settlement", async () => {
    const order: string[] = [];
    let release!: () => void;
    let entered!: () => void;
    const entry = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = TestExecutor.collectPhases([
      {
        name: "first",
        run: async () => {
          order.push("entered");
          entered();
          await barrier;
          order.push("settled");
        },
      },
      { name: "second", run: () => order.push("second") },
    ]);
    try {
      await entry;
      assert.deepEqual(order, ["entered"]);
    } finally {
      release();
      await pending;
    }
    assert.deepEqual(await pending, [
      { name: "first", status: "returned" },
      { name: "second", status: "returned" },
    ]);
    assert.deepEqual(order, ["entered", "settled", "second"]);
  });
  await check("both concurrent closes settle before dependent restoration", async () => {
    const order: string[] = [];
    const failure = new Error("first close refused");
    let release!: () => void;
    let entered!: () => void;
    const entry = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let unresolved: string[] = [];
    const pending = TestExecutor.collectPhases([
      {
        name: "concurrent resident closes",
        run: async () => {
          const outcomes = await Promise.allSettled([
            (async () => {
              order.push("close first");
              throw failure;
            })(),
            (async () => {
              order.push("close second");
              entered();
              await barrier;
              order.push("second joined");
            })(),
          ]);
          unresolved = outcomes.flatMap((outcome, index) =>
            outcome.status === "rejected" ? ["resident " + index] : [],
          );
          throw new AggregateError(
            outcomes.flatMap((outcome) =>
              outcome.status === "rejected" ? [outcome.reason] : [],
            ),
            "resident close failures",
          );
        },
      },
    ]);
    try {
      await entry;
      assert.deepEqual(order, ["close first", "close second"]);
    } finally {
      release();
      await pending;
    }
    const closes = await pending;
    assert.deepEqual(order, ["close first", "close second", "second joined"]);
    assert.equal(closes[0]!.status, "failed");
    if (closes[0]!.status === "failed") {
      assert.ok(closes[0]!.error instanceof AggregateError);
      assert.equal(closes[0]!.error.errors[0], failure);
    }
    assert.deepEqual(
      await TestExecutor.collectPhases([
        {
          name: "restore shared source",
          blockedBy: unresolved,
          run: () => assert.fail("restore before closure authority"),
        },
      ]),
      [{
        name: "restore shared source",
        status: "blocked",
        blockedBy: ["resident 0"],
      }],
    );
  });
  await check("all independent restorations run and failed restore blocks fresh work", async () => {
    const order: string[] = [];
    const first = new Error("source restore failure");
    const second = new Error("config restore failure");
    const restored = await TestExecutor.collectPhases([
      {
        name: "restore source",
        run: () => {
          order.push("source");
          throw first;
        },
      },
      {
        name: "restore config",
        run: () => {
          order.push("config");
          throw second;
        },
      },
      { name: "restore descriptor", run: () => order.push("descriptor") },
    ]);
    const blockedBy = restored.flatMap((outcome) =>
      outcome.status === "returned" ? [] : [outcome.name],
    );
    assert.deepEqual(order, ["source", "config", "descriptor"]);
    assert.deepEqual(restored, [
      { name: "restore source", status: "failed", error: first },
      { name: "restore config", status: "failed", error: second },
      { name: "restore descriptor", status: "returned" },
    ]);
    assert.deepEqual(
      await TestExecutor.collectPhases([
        {
          name: "fresh native controls",
          blockedBy,
          run: () => assert.fail("failed restoration granted authority"),
        },
      ]),
      [{
        name: "fresh native controls",
        status: "blocked",
        blockedBy: ["restore source", "restore config"],
      }],
    );
  });
  await check("undefined throw remains an actual failure", async () => {
    assert.deepEqual(
      await TestExecutor.collectPhases([
        {
          name: "undefined",
          run: () => {
            throw undefined;
          },
        },
        { name: "next", blockedBy: [], run: () => undefined },
      ]),
      [
        { name: "undefined", status: "failed", error: undefined },
        { name: "next", status: "returned" },
      ],
    );
  });
  if (failures.length)
    throw new AggregateError(failures, "Named phase collection failures");
}
