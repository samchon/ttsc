// Loads a CommonJS-style runtime pack for the playground's Execute sandbox.
//
// The pack JSON itself is built by the site (e.g. `pack-typia-runtime.cjs`
// in the ttsc website) and served at a site-chosen URL. It mirrors the
// layout the typia transform's emit references -- `typia/lib/internal/*`,
// `@typia/utils/lib/*`, etc. -- so a bundle's
// `require("typia/lib/internal/X")` resolves to the matching pack entry.
import type { ILoadTypiaRuntimePackOptions } from "../structures/ILoadTypiaRuntimePackOptions";

interface RuntimePackEntry {
  controller: AbortController;
  promise: Promise<Record<string, string>>;
}

interface RuntimePackCancellationReason {
  kind: "abort" | "timeout";
  reason?: unknown;
  timeoutMs?: number;
}

interface RuntimePackCancellation {
  promise: Promise<never>;
  dispose: () => void;
}

export const DEFAULT_RUNTIME_PACK_TIMEOUT_MS = 30_000;

const packCache = new Map<string, RuntimePackEntry>();

/**
 * Fetches the prebuilt runtime pack once per URL.
 *
 * Concurrent callers share one load. A caller abort or deadline cancels that
 * shared attempt; rejection removes it from the cache so the next call retries
 * from scratch. Successful packs remain cached.
 */
export function loadTypiaRuntimePack(
  url: string,
  options: ILoadTypiaRuntimePackOptions = {},
): Promise<Record<string, string>> {
  const timeoutMs = resolveRuntimePackTimeout(options.timeoutMs);
  const cached = packCache.get(url);
  if (cached) {
    attachRuntimePackCancellation(cached, options.signal, timeoutMs);
    return cached.promise;
  }

  const controller = new AbortController();
  let phase = `fetching ${url}`;
  const cancellation = createRuntimePackCancellation(
    controller.signal,
    () => phase,
  );
  let entry!: RuntimePackEntry;
  const promise = (async () => {
    const response = await raceRuntimePackCancellation(
      fetch(url, { signal: controller.signal }),
      cancellation.promise,
      controller.signal,
      () => phase,
    );
    if (!response.ok)
      throw new Error(
        `loadTypiaRuntimePack: failed to fetch ${url}: ${response.status}`,
      );

    phase = `reading JSON from ${url}`;
    return (await raceRuntimePackCancellation(
      response.json(),
      cancellation.promise,
      controller.signal,
      () => phase,
    )) as Record<string, string>;
  })()
    .catch((error) => {
      if (packCache.get(url) === entry) packCache.delete(url);
      throw error;
    })
    .finally(cancellation.dispose);

  entry = { controller, promise };
  packCache.set(url, entry);
  attachRuntimePackCancellation(entry, options.signal, timeoutMs);
  return promise;
}

function resolveRuntimePackTimeout(timeoutMs: number | undefined): number {
  const value = timeoutMs ?? DEFAULT_RUNTIME_PACK_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647)
    throw new RangeError(
      "loadTypiaRuntimePack: timeoutMs must be a positive integer no greater than 2147483647.",
    );
  return value;
}

function attachRuntimePackCancellation(
  entry: RuntimePackEntry,
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): void {
  const abortFromCaller = (): void => {
    if (!entry.controller.signal.aborted)
      entry.controller.abort({
        kind: "abort",
        reason: callerSignal?.reason,
      } satisfies RuntimePackCancellationReason);
  };
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timer = setTimeout(() => {
    if (!entry.controller.signal.aborted)
      entry.controller.abort({
        kind: "timeout",
        timeoutMs,
      } satisfies RuntimePackCancellationReason);
  }, timeoutMs);
  const cleanup = (): void => {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  };
  void entry.promise.then(cleanup, cleanup);
}

function createRuntimePackCancellation(
  signal: AbortSignal,
  getPhase: () => string,
): RuntimePackCancellation {
  let rejectCancellation!: (error: Error) => void;
  const promise = new Promise<never>((_resolve, reject) => {
    rejectCancellation = reject;
  });
  const onAbort = (): void => {
    rejectCancellation(runtimePackCancellationError(signal, getPhase()));
  };
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  return {
    promise,
    dispose: () => signal.removeEventListener("abort", onAbort),
  };
}

async function raceRuntimePackCancellation<T>(
  work: Promise<T>,
  cancellation: Promise<never>,
  signal: AbortSignal,
  getPhase: () => string,
): Promise<T> {
  try {
    return await Promise.race([work, cancellation]);
  } catch (error) {
    if (signal.aborted) throw runtimePackCancellationError(signal, getPhase());
    throw error;
  }
}

function runtimePackCancellationError(
  signal: AbortSignal,
  phase: string,
): Error {
  const reason = signal.reason as RuntimePackCancellationReason | undefined;
  if (reason?.kind === "timeout")
    return new Error(
      `loadTypiaRuntimePack: timed out after ${reason.timeoutMs}ms while ${phase}.`,
    );

  const error = new Error(`loadTypiaRuntimePack: aborted while ${phase}.`);
  const cause = reason?.kind === "abort" ? reason.reason : signal.reason;
  if (cause !== undefined) (error as Error & { cause?: unknown }).cause = cause;
  return error;
}
