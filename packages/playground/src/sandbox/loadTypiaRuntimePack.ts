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
  kind: "abort";
  reason?: unknown;
}

interface RuntimePackCancellation {
  promise: Promise<never>;
  dispose: () => void;
}

const packCache = new Map<string, RuntimePackEntry>();

/**
 * Fetches the prebuilt runtime pack once per URL.
 *
 * Concurrent callers share one load. A caller abort cancels that shared
 * attempt; rejection removes it from the cache so the next call retries from
 * scratch. Successful packs remain cached. Nothing else ends the load: how long
 * a fetch takes belongs to the network, not to a number chosen here.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Fetch, AbortController and Promise sharing implement the site-selected
 *   runtime-pack transport. The loader returns source records for the existing
 *   resolver rather than evaluating packages or introducing another module
 *   protocol.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The URL map owns shared attempt identity; cancellation helpers isolate
 *   event cleanup from transport decoding and the resolver owns evaluation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The URL comes from the caller, and load failures remain failures. Shared
 *   cancellation is an explicit public policy rather than a fixture-specific
 *   timeout or a replacement of fetch internals; rejection removes the owned
 *   entry instead of returning a fabricated empty pack.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc separates the per-URL purpose from shared cancellation,
 *   rejection eviction and network waiting policy. Those reasons follow the
 *   documentation skill, and ILoadTypiaRuntimePackOptions documents the
 *   cancellation scope.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Map lookup indexes loads, and cancellation events end stalled work without
 *   periodic polling. Fetch and JSON decoding process each shared attempt once.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   A URL shares the network request and decoded records across Execute
 *   preparation. Successful reuse assumes that URL identifies immutable pack
 *   content during the module lifetime; cache-busting URLs select new content.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Failed attempts are evicted and cancellation listeners are disposed.
 *   Successful records remain for the module lifetime, with memory growing
 *   with distinct URLs and retained bytes and no fixed successful-entry bound.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Works on in-memory strings and the wasm virtual filesystem; it reaches no native filesystem, path-identity or process boundary.
 */
export function loadTypiaRuntimePack(
  url: string,
  options: ILoadTypiaRuntimePackOptions = {},
): Promise<Record<string, string>> {
  const cached = packCache.get(url);
  if (cached) {
    attachRuntimePackCancellation(cached, options.signal);
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
    const pack: unknown = await raceRuntimePackCancellation(
      response.json(),
      cancellation.promise,
      controller.signal,
      () => phase,
    );
    if (
      !pack ||
      typeof pack !== "object" ||
      Array.isArray(pack) ||
      !Object.values(pack).every((value) => typeof value === "string")
    ) {
      throw new Error("loadTypiaRuntimePack: expected a source-text record map.");
    }
    return pack as Record<string, string>;
  })()
    .catch((error) => {
      if (packCache.get(url) === entry) packCache.delete(url);
      throw error;
    })
    .finally(cancellation.dispose);

  entry = { controller, promise };
  packCache.set(url, entry);
  attachRuntimePackCancellation(entry, options.signal);
  return promise;
}

function attachRuntimePackCancellation(
  entry: RuntimePackEntry,
  callerSignal: AbortSignal | undefined,
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

  const cleanup = (): void => {
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
  const error = new Error(`loadTypiaRuntimePack: aborted while ${phase}.`);
  const cause = reason?.kind === "abort" ? reason.reason : signal.reason;
  if (cause !== undefined) (error as Error & { cause?: unknown }).cause = cause;
  return error;
}
