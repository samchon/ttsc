// Loads a CommonJS-style runtime pack for the playground's Execute sandbox.
//
// The pack JSON itself is built by the site (e.g. `pack-typia-runtime.cjs`
// in the ttsc website) and served at a site-chosen URL. It mirrors the
// layout the typia transform's emit references — `typia/lib/internal/*`,
// `@typia/utils/lib/*`, etc. — so a bundle's `require("typia/lib/internal/X")`
// resolves to the matching pack entry.

const packCache = new Map<string, Promise<Record<string, string>>>();

/**
 * Fetches the prebuilt runtime pack once per URL. Re-entrant on the same
 * in-flight promise. On rejection the cache entry is cleared so the next call
 * retries — otherwise a transient fetch failure (CDN blip, offline at first
 * Execute) would permanently break every later Execute attempt.
 */
export async function loadTypiaRuntimePack(
  url: string,
): Promise<Record<string, string>> {
  const cached = packCache.get(url);
  if (cached) return cached;
  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `loadTypiaRuntimePack: failed to fetch ${url}: ${response.status}`,
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
