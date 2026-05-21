// Loads typia + @typia/interface + @typia/utils + @typia/core source files
// into the in-browser MemFS so the wasm-side compiler can resolve
// `import typia, { tags } from "typia"` against the same code the published
// package uses.
//
// The pack itself is built by `website/build/pack-typia-sources.cjs` and
// served from `/compiler/typia-pack.json`. Each entry is keyed by the
// package-relative path; we mount everything under `/work/node_modules/`.
//
// Why this exists: the playground's wasm has no access to the host's
// node_modules, so without the pack `tsgo` and typia's transformer both
// fail with "Cannot find module 'typia'". Mounting the source tree gives
// typia's `EmitCallWithOptions` real Type definitions to inspect.

import type { IMemFSHost } from "@ttsc/wasm";

export const TYPIA_PACK_URL = "/compiler/typia-pack.json";
const MOUNT_ROOT = "/work/node_modules";

let cached: Promise<Record<string, string>> | null = null;

/** Fetches the prebuilt pack from `/compiler/typia-pack.json`. */
export async function loadTypiaPack(): Promise<Record<string, string>> {
  if (cached) return cached;
  cached = (async () => {
    const response = await fetch(TYPIA_PACK_URL);
    if (!response.ok) {
      throw new Error(
        `loadTypiaPack: failed to fetch ${TYPIA_PACK_URL}: ${response.status}`,
      );
    }
    return (await response.json()) as Record<string, string>;
  })();
  return cached;
}

/**
 * Writes every pack entry into the supplied MemFS host under
 * `/work/node_modules/`. Idempotent: re-installing on the same host is a
 * no-op when the underlying writeFile is.
 */
export async function installTypiaPack(host: IMemFSHost): Promise<void> {
  const pack = await loadTypiaPack();
  host.mkdirp(MOUNT_ROOT);
  for (const [rel, content] of Object.entries(pack)) {
    host.writeFile(`${MOUNT_ROOT}/${rel}`, content);
  }
}
