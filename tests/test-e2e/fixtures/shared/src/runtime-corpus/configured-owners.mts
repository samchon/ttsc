// @ts-ignore -- this corpus intentionally supplies no Node declaration package.
import fs from "node:fs";
export async function observeConfiguredOwners(): Promise<unknown> {
  // Computed bare requests deliberately keep the two incompatible owners out
  // of the root NodeNext checker population. Every requested node of each family is
  // supplied upfront under one owner, not a project/configuration per case.
  const esnextName: string = "batch-configured-esnext";
  const legacyName: string = "batch-configured-legacy";
  const esnext = await import(esnextName);
  const legacy = await import(legacyName);
  const manifest = JSON.parse(fs.readFileSync((globalThis as any).process.env.TTSX_RUNTIME_MANIFEST, "utf8")) as { depCacheDir: string };
  const emitted = fs.readdirSync(manifest.depCacheDir, { recursive: true }) as string[];
  return {
    esnext: [esnext.hello(), esnext.sentinel, esnext.derived], legacy: legacy.default.values,
    wholeProject: { wrapped: esnext.wrap(7), unimportedEmitted: emitted.some((file) => file.endsWith("configured-unused.js")) },
    declaredOutputs: [esnext.inside, legacy.default.extra],
    classification: esnext.classification,
  };
}
