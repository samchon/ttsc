import type { IMemFSHost } from "@ttsc/wasm";

import type { IInstallTypiaSourcePackOptions } from "../structures/IInstallTypiaSourcePackOptions";
import { installTypiaSourcePack } from "./installTypiaSourcePack";

/**
 * Build a `mount` callback for the `typiaPlugin` config of
 * {@link createWorkerCompiler}.
 *
 * The returned function shares loading by URL and fetch function identity through
 * {@link loadTypiaSourcePack}, then writes every entry to the MemFS on each
 * invocation. Network records are cached, but mounting repeats so a
 * caller can restore files removed from the virtual host.
 *
 * @evidence contracts/common.md#principled-implementation Explicit mountRoot overrides the actual worker workDir; absent both, installation uses its documented virtual root.
 * @evidence contracts/common.md#clear-and-simple-design One adapter derives the root and delegates transport and writes to their owning operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The optional workDir preserves the supported single-argument callback while supplied project roots are honored instead of patched with fixed paths.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes cached loading from repeated mounting and explains callback compatibility, following documentation-skill paragraph separation.
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
