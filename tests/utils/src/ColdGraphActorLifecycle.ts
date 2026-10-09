import type { EventEmitter } from "node:events";

/**
 * Test-only settlement for the cold Graph parent and its public actor.
 *
 * Sending, captured progress and terminal shutdown share one protocol owner;
 * none supplies Graph answers or replaces the original process/native join.
 * The real scene and CJS actor use these operations directly, while portable
 * units control only their own events, callbacks and pending stage promises.
 *
 * @evidence contracts/common.md#principled-implementation The namespace groups Node IPC callback settlement, ordered actor observations and one in-flight terminal promise, preserving the distinct send, progress and original retirement meanings.
 * @evidence contracts/common.md#clear-and-simple-design Exposes only the three operations shared by the actual cold Graph parent/actor protocol; there is no runner, message schema, public SDK extension or unrelated process policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Retains actual channel/emitter/shutdown owners without foreign mutation, fabricated Session success, retries or elapsed-time answers.
 * @evidence contracts/common.md#meaningful-documentation Describes the test-only consumer boundary and distinguishes portable controlled stages from actual Graph/native acceptance; individual operations document ordering and failure effects.
 * @evidence contracts/portability.md#os-neutral-implementation Represents platform-neutral Node IPC/events and promises; callers still own OS process generations, native retirement and file-URL loader resolution.
 * @evidence contracts/performance.md#efficient-algorithms Uses constant-time captured-event lookup, current-waiter notification and one fixed terminal sequence; no process or filesystem polling is added.
 * @evidence contracts/performance.md#reuse-equivalent-work Parent waits share one observation and competing terminal requests share one promise; effectful IPC sends remain distinct actual operations.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each observation releases settled waiters and explicitly disposes listeners; the actor retains one terminal promise until its shutdown/publication/disconnect settles. Original process/native retirement remains independently required.
 */
export namespace ColdGraphActorLifecycle {
  /**
   * Await the original IPC send callback before advancing or disconnecting.
   *
   * The callback acknowledges sending, not the peer's handling or native join.
   * Missing channels, synchronous throws and asynchronous errors all reject.
   *
   * @evidence contracts/common.md#principled-implementation Wraps Node's supported send callback so asynchronous channel errors belong to the awaiting operation; a boolean backpressure result is not mistaken for completion.
   * @evidence contracts/common.md#clear-and-simple-design One callback adapter serves actual parent commands and actor publications without introducing another transport or message schema.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Calls the original channel method, preserving its synchronous and asynchronous errors without replacing foreign methods or swallowing closed-channel failures.
   * @evidence contracts/common.md#meaningful-documentation Distinguishes callback acknowledgment from peer handling and native retirement, and documents unavailable-channel rejection.
   * @evidence contracts/portability.md#os-neutral-implementation Uses Node IPC callback semantics on supported Windows and POSIX hosts; no platform-specific channel representation is assumed.
   * @evidence contracts/performance.md#efficient-algorithms Allocates one promise per actual message and performs no polling or retained message history.
   * @evidence contracts/performance.md#reuse-equivalent-work A send is effectful and is not repeated or deduplicated; terminal ownership separately prevents duplicate terminal messages.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The send promise retains its callback until Node acknowledges or rejects it; the original process and outer cancellation boundary own any still-open channel.
   */
  export function send(
    source: {
      send?: (
        message: string | Record<string, unknown>,
        callback: (error: Error | null) => void,
      ) => boolean;
    },
    message: string | Record<string, unknown>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!source.send) {
        reject(new Error("Cold Graph actor has no original IPC channel"));
        return;
      }
      source.send(message, (error) => error ? reject(error) : resolve());
    });
  }

  /**
   * Capture actor progress before callers begin waiting for it.
   *
   * A required event permits progress only if no failure preceded it. Errors,
   * disconnect and original close reject missing progress without a clock
   * oracle. The caller still owns the actual process join and operator cancel.
   * Conditional observations can synchronously check the same captured failure.
   * Dispose after that join to release this observation's listeners.
   *
   * @evidence contracts/common.md#principled-implementation Node event listeners capture delivered messages and original process errors synchronously; sequence order distinguishes an earlier required event from an earlier failure. Each waiter subscribes before inspecting captured state, so delivery cannot fall between inspection and subscription.
   * @evidence contracts/common.md#clear-and-simple-design One observation retains event order and wakes its pending callers; actual process completion and resource assertions remain with the scene.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Uses the actual emitter's message/error/disconnect/close events without replacing methods, introducing deadlines or certifying product success.
   * @evidence contracts/common.md#meaningful-documentation Documents event ordering, missing-progress failures, original join ownership and explicit listener disposal.
   * @evidence contracts/portability.md#os-neutral-implementation Uses Node EventEmitter lifecycle events shared by Windows and POSIX; no PID, signal-delivery or filesystem assumption substitutes for original close.
   * @evidence contracts/performance.md#efficient-algorithms Captured event lookup is constant time; each incoming event wakes only current waiters. State grows with this finite actor protocol's distinct event names and outstanding waits.
   * @evidence contracts/performance.md#reuse-equivalent-work All callers share the same captured event/error order instead of installing independent process observations or repeating polling.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Settled waiters leave the pending set immediately; dispose rejects outstanding waits and removes all four original emitter listeners after the scene's authoritative process join.
   */
  export function observe(source: EventEmitter): {
    events: ReadonlySet<string>;
    wait(event: string): Promise<void>;

    /** Reject conditional observations after the original actor fails or closes. */
    check(): void;
    dispose(): void;
  } {
    const events = new Set<string>();
    const order = new Map<string, number>();
    const pending = new Set<() => void>();
    let sequence = 0;
    let failure: { order: number; error: unknown } | undefined;
    const wake = (): void => {
      for (const check of [...pending]) check();
    };
    const fail = (error: unknown): void => {
      failure ??= { order: ++sequence, error };
      wake();
    };
    const message = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      const event = Reflect.get(value, "event");
      if (typeof event !== "string") return;
      events.add(event);
      if (!order.has(event)) order.set(event, ++sequence);
      if (event === "failed" || event === "close-failed")
        failure ??= {
          order: order.get(event)!,
          error: new Error(
            `Public session actor ${event}: ${String(Reflect.get(value, "diagnostic"))}`,
          ),
        };
      wake();
    };
    const disconnected = (): void =>
      fail(new Error("Public session actor disconnected before required event"));
    const closed = (): void =>
      fail(new Error("Public session actor closed before required event"));
    source.on("message", message);
    source.on("error", fail);
    source.on("disconnect", disconnected);
    source.on("close", closed);
    return {
      events,
      check: () => {
        if (failure) throw failure.error;
      },
      wait: (event) => new Promise<void>((resolve, reject) => {
        const check = (): void => {
          const delivered = order.get(event);
          if (failure && (delivered === undefined || failure.order < delivered)) {
            pending.delete(check);
            reject(failure.error);
          } else if (delivered !== undefined) {
            pending.delete(check);
            resolve();
          }
        };
        pending.add(check);
        check();
      }),
      dispose: () => {
        fail(new Error("Public session actor observation disposed"));
        source.removeListener("message", message);
        source.removeListener("error", fail);
        source.removeListener("disconnect", disconnected);
        source.removeListener("close", closed);
      },
    };
  }

  /**
   * Share one terminal shutdown, queue drain, publication and disconnect.
   *
   * Operation failure requests this owner without awaiting it inside the queue
   * that drain awaits. Publication receives any shutdown/drain/verification
   * failures and must acknowledge its actual send before returning. Every
   * stage's error remains in the rejected terminal result, including a failed
   * publication or disconnect; no terminal message certifies failed shutdown.
   *
   * @evidence contracts/common.md#principled-implementation A promise is installed before any callback executes, making concurrent requests share exactly one terminal sequence. Shutdown precedes drain to cancel active work; the queue must return independently before verification and publication, avoiding a circular await.
   * @evidence contracts/common.md#clear-and-simple-design Five callbacks expose the actor's actual shutdown, queue, closed-state assertion, terminal send and disconnect. This helper owns only their ordering and complete failure aggregation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Calls the owning operations once without mocked product answers, retries, timer substitution or suppression of publication errors.
   * @evidence contracts/common.md#meaningful-documentation Explains queue self-dependency, send acknowledgment, terminal failure data and the caller's responsibility to observe rejection.
   * @evidence contracts/portability.md#os-neutral-implementation Orders platform-neutral promises; callers retain the actual Node IPC send callback, native join and process disconnect boundaries.
   * @evidence contracts/performance.md#efficient-algorithms Executes one fixed sequence and retains at most one failure per stage, independent of concurrent close request count.
   * @evidence contracts/performance.md#reuse-equivalent-work Explicit close and operation failure share the identical in-flight terminal promise, so neither repeats Session shutdown or terminal publication.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The actor's queue and Session retire before publication/disconnect. The single retained promise lasts for this actor lifetime; publication and cleanup failures reject rather than authorizing resource success.
   */
  export function terminal(options: {
    close(): Promise<void>;
    drain(): Promise<void>;
    verify(): Promise<void>;
    publish(failures: readonly unknown[]): Promise<void>;
    disconnect(): void;
  }): () => Promise<void> {
    let completion: Promise<void> | undefined;
    return () => completion ??= Promise.resolve().then(async () => {
      const failures: unknown[] = [];
      for (const run of [options.close, options.drain, options.verify]) {
        try { await run(); }
        catch (error) { failures.push(error); }
      }
      try { await options.publish(Object.freeze([...failures])); }
      catch (error) { failures.push(error); }
      try { options.disconnect(); }
      catch (error) { failures.push(error); }
      if (failures.length)
        throw new AggregateError(failures, "Cold Graph actor terminal settlement failed");
    });
  }
}
