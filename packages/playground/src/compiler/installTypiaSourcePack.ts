import type { IMemFSHost } from "@ttsc/wasm";

import type { IInstallTypiaSourcePackOptions } from "../structures/IInstallTypiaSourcePackOptions";
import { loadTypiaSourcePack } from "./loadTypiaSourcePack";

/**
 * Mounts typia + @typia/* source trees into the in-browser MemFS so the
 * wasm-side compiler can resolve `import typia, { tags } from "typia"`
 * against the same code the published package uses.
 *
 * Idempotent on the same host (re-writing the same paths is a no-op for the
 * MemFS implementation).
 */
export async function installTypiaSourcePack(
  host: IMemFSHost,
  options: IInstallTypiaSourcePackOptions,
): Promise<void> {
  const mountRoot = options.mountRoot ?? "/work/node_modules";
  const pack = await loadTypiaSourcePack(options);
  host.mkdirp(mountRoot);
  for (const [rel, content] of Object.entries(pack)) {
    host.writeFile(`${mountRoot}/${rel}`, content);
  }
}
