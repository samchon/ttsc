import type { IInstallTypiaSourcePackOptions } from "../structures/IInstallTypiaSourcePackOptions";

interface SourcePackEntry {
  controller: AbortController;
  promise: Promise<Record<string, string>>;
}

interface SourcePackCancellationReason {
  kind: "abort";
  reason?: unknown;
}

interface SourcePackCancellation {
  promise: Promise<never>;
  dispose: () => void;
}

const packCache = new Map<string, SourcePackEntry>();

/**
 * Fetch the typia source pack JSON once per URL.
 *
 * Concurrent callers share one load. A caller abort cancels that shared
 * attempt; rejection removes it from the cache so the next call retries from
 * scratch. Nothing else ends the load: how long a fetch takes belongs to the
 * network, not to a number chosen here.
 */
export function loadTypiaSourcePack(
  options: IInstallTypiaSourcePackOptions,
): Promise<Record<string, string>> {
  const cached = packCache.get(options.url);
  if (cached) {
    attachSourcePackCancellation(cached, options.signal);
    return cached.promise;
  }

  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new Error(
      "loadTypiaSourcePack: no fetch implementation available in this environment.",
    );
  }

  const url = options.url;
  const controller = new AbortController();
  let phase = `fetching ${url}`;
  const cancellation = createSourcePackCancellation(
    controller.signal,
    () => phase,
  );
  let entry!: SourcePackEntry;
  const promise = (async () => {
    const response = await raceSourcePackCancellation(
      fetchImpl(url, { signal: controller.signal }),
      cancellation.promise,
      controller.signal,
      () => phase,
    );
    if (!response.ok) {
      throw new Error(
        `loadTypiaSourcePack: failed to fetch ${url}: ${response.status}`,
      );
    }

    phase = `reading JSON from ${url}`;
    return (await raceSourcePackCancellation(
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
  attachSourcePackCancellation(entry, options.signal);
  return promise;
}

function attachSourcePackCancellation(
  entry: SourcePackEntry,
  callerSignal: AbortSignal | undefined,
): void {
  const abortFromCaller = (): void => {
    if (!entry.controller.signal.aborted) {
      entry.controller.abort({
        kind: "abort",
        reason: callerSignal?.reason,
      } satisfies SourcePackCancellationReason);
    }
  };
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const cleanup = (): void => {
    callerSignal?.removeEventListener("abort", abortFromCaller);
  };
  void entry.promise.then(cleanup, cleanup);
}

function createSourcePackCancellation(
  signal: AbortSignal,
  getPhase: () => string,
): SourcePackCancellation {
  let rejectCancellation!: (error: Error) => void;
  const promise = new Promise<never>((_resolve, reject) => {
    rejectCancellation = reject;
  });
  const onAbort = (): void => {
    rejectCancellation(sourcePackCancellationError(signal, getPhase()));
  };
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  return {
    promise,
    dispose: () => signal.removeEventListener("abort", onAbort),
  };
}

async function raceSourcePackCancellation<T>(
  work: Promise<T>,
  cancellation: Promise<never>,
  signal: AbortSignal,
  getPhase: () => string,
): Promise<T> {
  try {
    return await Promise.race([work, cancellation]);
  } catch (error) {
    if (signal.aborted) {
      throw sourcePackCancellationError(signal, getPhase());
    }
    throw error;
  }
}

function sourcePackCancellationError(
  signal: AbortSignal,
  phase: string,
): Error {
  const reason = signal.reason as SourcePackCancellationReason | undefined;
  const error = new Error(`loadTypiaSourcePack: aborted while ${phase}.`);
  const cause = reason?.kind === "abort" ? reason.reason : signal.reason;
  if (cause !== undefined) (error as Error & { cause?: unknown }).cause = cause;
  return error;
}
