import type { IMemFSHost } from "@ttsc/wasm";

import type { IInstallTypiaSourcePackOptions } from "../structures/IInstallTypiaSourcePackOptions";
import { loadTypiaSourcePack } from "./loadTypiaSourcePack";

/**
 * Mounts typia + @typia/* source trees into the in-browser MemFS so the
 * wasm-side compiler can resolve `import typia, { tags } from "typia"` against
 * the same code the published package uses.
 *
 * Repeated calls write the same loaded records again; this restores any entries
 * the caller removed from the virtual host and replaces values at pack paths.
 *
 * @evidence contracts/common.md#principled-implementation Source-pack entries are written under the selected virtual mount root after the shared transport completes; the pack is a site-produced trusted record map.
 * @evidence contracts/common.md#clear-and-simple-design Loading is delegated and this operation owns only root creation and entry writes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller supplies the pack URL and root; no consumer or fixture determines which source contents are mounted.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains resolution purpose and repeated-write behavior without claiming MemFS suppresses writes, following documentation-skill paragraphs.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It keeps no state, handle or listener after returning.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
  * @evidence contracts/performance.md#reuse-equivalent-work Delegates to loadTypiaSourcePack, so installs with the same URL and fetch share one load; the writes repeat on each call to restore removed files.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Works on in-memory strings and the wasm virtual filesystem; it reaches no native filesystem, path-identity or process boundary.
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
