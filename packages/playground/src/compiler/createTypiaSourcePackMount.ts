import type { IMemFSHost } from "@ttsc/wasm";

import type { IInstallTypiaSourcePackOptions } from "../structures/IInstallTypiaSourcePackOptions";
import { installTypiaSourcePack } from "./installTypiaSourcePack";

/**
 * Build a `mount` callback for the `typiaPlugin` config of
 * {@link createWorkerCompiler}.
 *
 * The returned function fetches the pack once (cached per URL by
 * {@link loadTypiaSourcePack}) and writes every entry to the MemFS the first
 * time it is invoked on a given host.
 */
export function createTypiaSourcePackMount(
  options: IInstallTypiaSourcePackOptions,
): (host: IMemFSHost, workDir?: string) => Promise<void> {
  return async (host: IMemFSHost, workDir?: string) => {
    // Honor the caller's workDir when the site did not pin mountRoot
    // explicitly. Otherwise a `createWorkerCompiler({workDir: '/foo'})`
    // would still mount typia under `/work/node_modules/` and tsgo would
    // never resolve `typia` from the project root.
    //
    // `workDir` is intentionally optional so callers built against the
    // previous single-arg signature (`mount(host)`) keep working — when
    // both mountRoot and workDir are absent, installTypiaSourcePack falls
    // back to its own default (`/work/node_modules`).
    const mountRoot =
      options.mountRoot ??
      (workDir ? `${workDir.replace(/\/+$/, "")}/node_modules` : undefined);
    await installTypiaSourcePack(host, { ...options, mountRoot });
  };
}
