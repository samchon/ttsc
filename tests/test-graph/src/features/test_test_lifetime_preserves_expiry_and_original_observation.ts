import assert from "node:assert/strict";

import { TestLifetime } from "../../../utils/src/TestLifetime";

/**
 * Verifies explicit failure budgets retain original observation and disposal.
 *
 * A timer can run after synchronous work returns, and a cancelled observation
 * can outlive its original producer. Neither case may clear a failure or
 * fabricate that producer's completion.
 *
 * 1. Limit a child to its parent's earlier deadline and expire a pending
 *    observation.
 * 2. Complete and reject the original promises independently of cancellation.
 * 3. Contrast timely disposal, overdue same-turn completion and invalid budget
 *    inputs.
 * 4. Refuse clock, scheduler acquisition and disposal independently, preserving
 *    every failure and every original disposal attempt.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual TestLifetime construction, checkpoints, promise observation, signal assertions and disposal preserve expiry, parent deadline, original rejection and the original promise's pending lifetime. Same-turn expiry and clock refusal cannot skip registered disposal; failed attempts remain unknown while independent disposers still run. Constructor refusal transfers failed capabilities and preserves acquisition, clock and disposal faults.
 * @evidence contracts/testing.md#independent-expectations Authored clock values, parent deadline and explicitly controlled scheduling determine each budget boundary. Independent deferred promises define actual completion or rejection; observation cancellation cannot settle those promises.
 * @evidence contracts/testing.md#distinguishing-cases Parent-capped and expired admission, pending and already settled originals, late original rejection, callback and same-turn expiry, repeated disposal, callback after timely disposal and invalid timer or clock ranges remain separate outcomes. Clock-only, disposer-only, combined and prior-expiry refusals preserve order and attempts; constructor failure distinguishes released from retained capabilities and independent undefined faults. Native actor joining and actual scenes remain E2E boundaries.
 * @evidence contracts/testing.md#execution-ownership This discoverable test-graph unit calls the shared source helper with its supported owned clock/scheduling seams. It replaces no timer, filesystem or environment method and starts no process, worker, native recorder or compiler.
 */
export async function test_test_lifetime_preserves_expiry_and_original_observation(): Promise<void> {
  let now = 1_000;
  let expire!: () => void;
  let disposed = 0;
  const delays: number[] = [];
  const owner = new TestLifetime({
    name: "authored observation",
    timeoutMs: 120,
    deadline: 1_050,
    now: () => now,
    schedule: (callback, delay, own) => {
      expire = callback;
      delays.push(delay);
      own(() => {
        ++disposed;
      });
    },
  });
  assert.equal(owner.deadline, 1_050);
  assert.deepEqual(delays, [50]);
  owner.checkpoint("required publication");
  const original = Promise.withResolvers<number>();
  let originalFinished = false;
  void original.promise.then(() => {
    originalFinished = true;
  });
  const observation = owner.wait(original.promise);
  const refused = assert.rejects(
    observation,
    (error: unknown) => error === owner.signal.reason,
  );
  now = 1_050;
  expire();
  await refused;
  assert.equal(
    originalFinished,
    false,
    "observation cancellation cannot complete the producer",
  );
  const reason = owner.signal.reason;
  assert.match(reason.message, /required publication/);
  owner.checkpoint("original cleanup");
  owner.finish();
  owner.finish();
  assert.equal(disposed, 1);
  assert.throws(
    () => owner.assertActive(),
    (error) => error === reason,
  );
  original.resolve(7);
  assert.equal(await original.promise, 7);
  const late = Promise.withResolvers<void>();
  await assert.rejects(owner.wait(late.promise), (error) => error === reason);
  const originalRejection = new Error("original producer refused");
  const lateRefusal = assert.rejects(
    late.promise,
    (error) => error === originalRejection,
  );
  late.reject(originalRejection);
  await lateRefusal;

  let timelyExpire!: () => void;
  now = 2_000;
  const timely = new TestLifetime({
    name: "timely original join",
    timeoutMs: 120,
    now: () => now,
    schedule: (callback, _delay, own) => {
      timelyExpire = callback;
      own(() => {
        ++disposed;
      });
    },
  });
  assert.equal(await timely.wait(Promise.resolve(9)), 9);
  const nativeFailure = new Error("original failure");
  await assert.rejects(
    timely.wait(Promise.reject(nativeFailure)),
    (error) => error === nativeFailure,
  );
  timely.finish();
  now = 9_000;
  timelyExpire();
  timely.assertActive();
  assert.equal(
    timely.signal.aborted,
    false,
    "a disposed timely owner cannot expire afterward",
  );

  now = 3_000;
  let synchronousDisposed = false;
  const synchronous = new TestLifetime({
    name: "same-turn completion",
    timeoutMs: 120,
    now: () => now,
    schedule: (_callback, _delay, own) =>
      own(() => {
        synchronousDisposed = true;
      }),
  });
  now = 3_121;
  synchronous.finish();
  assert.equal(synchronousDisposed, true);
  assert.throws(() => synchronous.assertActive(), /same-turn completion/);
  let scheduled = false;
  const expired = new TestLifetime({
    name: "expired admission",
    timeoutMs: 120,
    deadline: 3_120,
    now: () => now,
    schedule: (_callback, _delay, own) => {
      scheduled = true;
      own(() => {});
    },
  });
  assert.equal(scheduled, false);
  await assert.rejects(
    expired.wait(Promise.resolve(1)),
    (error) => error === expired.signal.reason,
  );
  expired.finish();
  for (const timeoutMs of [0, -1, 0.5, NaN, Infinity, 2_147_483_648])
    assert.throws(
      () => new TestLifetime({ name: "invalid budget", timeoutMs }),
      RangeError,
    );
  assert.throws(
    () =>
      new TestLifetime({
        name: "invalid clock",
        timeoutMs: 120,
        now: () => NaN,
      }),
    RangeError,
  );
  assert.throws(
    () =>
      new TestLifetime({
        name: "imprecise deadline",
        timeoutMs: 120,
        now: () => Number.MAX_SAFE_INTEGER,
      }),
    RangeError,
  );

  for (const shape of ["clock", "disposer", "both", "expired-clock"] as const) {
    const clockFailure = new Error("original clock refusal " + shape);
    const disposalFailure = new Error("original disposer refusal " + shape);
    let refuseClock = false,
      releaseAttempts = 0,
      independentAttempts = 0;
    let released = false,
      independentReleased = false;
    let fire!: () => void;
    const lifetime = new TestLifetime({
      name: "owned failures " + shape,
      timeoutMs: 120,
      now: () => {
        if (refuseClock) throw clockFailure;
        return 4_000;
      },
      schedule: (callback, _delay, own) => {
        fire = callback;
        own(() => {
          ++releaseAttempts;
          if (shape === "disposer" || shape === "both") throw disposalFailure;
          released = true;
        });
        own(() => {
          ++independentAttempts;
          independentReleased = true;
        });
      },
    });
    if (shape === "expired-clock") fire();
    const expiry = lifetime.signal.reason;
    refuseClock = shape !== "disposer";
    const failures = lifetime.finish();
    assert.deepEqual(
      failures,
      shape === "expired-clock"
        ? [expiry, clockFailure]
        : shape === "both"
          ? [clockFailure, disposalFailure]
          : shape === "clock"
            ? [clockFailure]
            : [disposalFailure],
    );
    assert.equal(
      independentReleased,
      true,
      "one refused disposal must not skip another original capability",
    );
    assert.equal(
      released,
      shape !== "disposer" && shape !== "both",
      "failed disposal supplies no release proof",
    );
    assert.equal(
      lifetime.finish(),
      failures,
      "repeated finish returns the original complete failure ledger",
    );
    assert.equal(releaseAttempts, 1);
    assert.equal(independentAttempts, 1);
    assert.throws(
      () => lifetime.assertActive(),
      (error) =>
        failures.length === 1
          ? error === failures[0]
          : error instanceof AggregateError &&
            error.errors.length === failures.length &&
            error.errors.every((entry, index) => entry === failures[index]),
    );
  }

  for (const entry of ["assertion", "timer"] as const) {
    const clockFailure = new Error("clock refusal at " + entry);
    let refuseClock = false,
      releaseAttempts = 0;
    let fire!: () => void;
    const lifetime = new TestLifetime({
      name: "failure entry " + entry,
      timeoutMs: 120,
      now: () => {
        if (refuseClock) throw clockFailure;
        return 4_500;
      },
      schedule: (callback, _delay, own) => {
        fire = callback;
        own(() => {
          ++releaseAttempts;
        });
      },
    });
    refuseClock = true;
    if (entry === "assertion")
      assert.throws(
        () => lifetime.assertActive(),
        (error) => error === clockFailure,
      );
    else {
      // The scheduler's expiry callback reports its own deadline event and
      // performs no fallible clock read outside an assertion/finish boundary.
      assert.doesNotThrow(() => fire());
      assert.match(lifetime.signal.reason.message, /failure entry timer/);
    }
    const failures = lifetime.finish();
    assert.deepEqual(
      failures,
      entry === "assertion"
        ? [clockFailure]
        : [lifetime.signal.reason, clockFailure],
    );
    assert.equal(releaseAttempts, 1);
    assert.equal(lifetime.finish(), failures);
  }

  const acquisitionFailure = new Error(
    "original scheduler acquisition refusal",
  );
  let acquiredRelease = 0;
  assert.throws(
    () =>
      new TestLifetime({
        name: "refused scheduler",
        timeoutMs: 120,
        now: () => 5_000,
        schedule: (_callback, _delay, own) => {
          own(() => {
            ++acquiredRelease;
          });
          throw acquisitionFailure;
        },
      }),
    (error) => error === acquisitionFailure,
  );
  assert.equal(
    acquiredRelease,
    1,
    "acquisition refusal must retire the already registered capability",
  );

  let clockRefused = false,
    failedRelease = 0,
    siblingReleased = false;
  const failedCapability = () => {
    ++failedRelease;
    throw undefined;
  };
  assert.throws(
    () =>
      new TestLifetime({
        name: "independent primitive failures",
        timeoutMs: 120,
        now: () => {
          if (clockRefused) throw undefined;
          return 6_000;
        },
        schedule: (_callback, _delay, own) => {
          own(failedCapability);
          own(() => {
            siblingReleased = true;
          });
          clockRefused = true;
          throw undefined;
        },
      }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(
        error.errors,
        [undefined, undefined, undefined],
        "independent acquisition, clock and disposal refusals remain separate occurrences",
      );
      assert.deepEqual(error.cause, {
        disposal: "unknown",
        retainedDisposers: [failedCapability],
      });
      return true;
    },
  );
  assert.equal(failedRelease, 1);
  assert.equal(siblingReleased, true);

  const initialClockFailure = new Error("initial clock refusal");
  let acquisitionAttempted = false;
  assert.throws(
    () =>
      new TestLifetime({
        name: "initial clock",
        timeoutMs: 120,
        now: () => {
          throw initialClockFailure;
        },
        schedule: () => {
          acquisitionAttempted = true;
        },
      }),
    (error) => error === initialClockFailure,
  );
  assert.equal(
    acquisitionAttempted,
    false,
    "initial clock failure precedes acquisition",
  );
}
