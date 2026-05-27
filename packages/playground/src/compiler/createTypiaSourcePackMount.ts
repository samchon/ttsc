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
): (host: IMemFSHost) => Promise<void> {
  return async (host: IMemFSHost) => {
    await installTypiaSourcePack(host, options);
  };
}
