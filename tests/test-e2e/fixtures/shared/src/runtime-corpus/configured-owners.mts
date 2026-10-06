// @ts-ignore -- this corpus intentionally supplies no Node declaration package.
import fs from "node:fs";
export async function observeConfiguredOwners(): Promise<unknown> {
  // Computed bare requests deliberately keep the two incompatible owners out
  // of the root NodeNext checker population. Every requested node of each family is
  // supplied upfront under one owner, not a project/configuration per case.
  const esnextName: string = "batch-configured-esnext";
  const legacyName: string = "batch-configured-legacy";
  // Both real JSX lanes are attempted even if one fails. They join the existing
  // configured owner and configless package in this same Runtime graph.
  const jsxModules = await Promise.allSettled([import(esnextName), import(legacyName)]);
  const jsxFailures = jsxModules.flatMap((result, index) => result.status === "rejected"
    ? [new Error(index === 0 ? "configured preserved JSX" : "pragma-selected orphan JSX", { cause: result.reason })] : []);
  if (jsxFailures.length) throw new AggregateError(jsxFailures, "shared configured and orphan JSX loads failed");
  const esnext = (jsxModules[0] as PromiseFulfilledResult<any>).value;
  const legacy = (jsxModules[1] as PromiseFulfilledResult<any>).value;
  console.info("entry:" + esnext.strippedDependency);
  const manifest = JSON.parse(fs.readFileSync((globalThis as any).process.env.TTSX_RUNTIME_MANIFEST, "utf8")) as { depCacheDir: string };
  const emitted = fs.readdirSync(manifest.depCacheDir, { recursive: true }) as string[];
  if (!emitted.some((file) => file.endsWith("configured-unused.js"))) {
    (globalThis as any).console.error("TTSC_CONFIGURED_OWNER_EMIT:" + JSON.stringify({
      manifest: (globalThis as any).process.env.TTSX_RUNTIME_MANIFEST,
      depCacheDir: manifest.depCacheDir,
      emitted,
    }));
  }
  return {
    esnext: [esnext.hello(), esnext.sentinel, esnext.derived], legacy: legacy.default.values,
    wholeProject: { wrapped: esnext.wrap(7), unimportedEmitted: emitted.some((file) => file.endsWith("configured-unused.js")) },
    declaredOutputs: [esnext.inside, legacy.default.extra],
    strippedDependency: esnext.strippedDependency,
    classification: esnext.classification,
    moduleValues: { enumRuntime: esnext.enumRuntime, namespaceRuntime: esnext.namespaceRuntime },
    jsx: { dependency: esnext.preservedView, orphan: legacy.default.orphanView },
  };
}
