import type { IInstallTypiaSourcePackOptions } from "../structures/IInstallTypiaSourcePackOptions";

const packCache = new Map<string, Promise<Record<string, string>>>();

/**
 * Fetch the typia source pack JSON. Cached per URL across calls. On
 * rejection the cache entry is cleared so the next call retries —
 * otherwise a transient fetch failure during the first boot would wedge
 * every later boot through `getBoot`'s typiaPlugin.mount path.
 */
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
  const url = options.url;
  const promise = (async () => {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(
        `loadTypiaSourcePack: failed to fetch ${url}: ${response.status}`,
      );
    }
    return (await response.json()) as Record<string, string>;
  })().catch((err) => {
    packCache.delete(url);
    throw err;
  });
  packCache.set(url, promise);
  return promise;
}
