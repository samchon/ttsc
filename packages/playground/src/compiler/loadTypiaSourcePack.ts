import type { IInstallTypiaSourcePackOptions } from "../structures/IInstallTypiaSourcePackOptions";

const packCache = new Map<string, Promise<Record<string, string>>>();

/** Fetch the typia source pack JSON. Cached per URL across calls. */
export function loadTypiaSourcePack(
  options: IInstallTypiaSourcePackOptions,
): Promise<Record<string, string>> {
  const cached = packCache.get(options.url);
  if (cached) return cached;
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new Error(
      "loadTypiaSourcePack: no fetch implementation available in this environment.",
    );
  }
  const promise = (async () => {
    const response = await fetchImpl(options.url);
    if (!response.ok) {
      throw new Error(
        `loadTypiaSourcePack: failed to fetch ${options.url}: ${response.status}`,
      );
    }
    return (await response.json()) as Record<string, string>;
  })();
  packCache.set(options.url, promise);
  return promise;
}
