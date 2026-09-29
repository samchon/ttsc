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
 *
 * @evidence contracts/common.md#principled-implementation
 *   The source-pack loader uses fetch/AbortController and Promise sharing,
 *   with an explicit fetch injection seam for the same transport contract. It
 *   supplies source records to the existing mounting operation rather than
 *   coupling network loading to compiler execution.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The site supplies the URL and transport; no package name, test case or
 *   fixed deadline decides success. The injected transport leaves global fetch
 *   intact. Rejection evicts only this attempt, preserving the real failure
 *   instead of inventing a successful empty source pack.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains the once-per-URL purpose, shared cancellation, rejection
 *   eviction and why an arbitrary timeout is not the network policy. Purpose
 *   and reasons use separate native paragraphs under the documentation skill;
 *   IInstallTypiaSourcePackOptions owns option documentation.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Map lookup indexes loads, and event-driven cancellation avoids polling.
 *   Fetch and JSON decoding perform the requested transport work once per
 *   shared attempt; mounting owns the later filesystem writes.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The URL shares loading and decoded records across mount requests. The
 *   design assumes one URL names immutable source content and compatible
 *   transport semantics during the module lifetime; different injected fetch
 *   implementations currently share that URL entry, an unresolved identity
 *   limitation to reassess during adoption.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Failure evicts its attempt and cancellation listeners are disposed.
 *   Successful records persist for the module lifetime, with memory scaling
 *   with distinct URLs and pack contents and no fixed eviction budget.
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
