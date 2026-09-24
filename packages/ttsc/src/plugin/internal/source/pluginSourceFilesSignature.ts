import crypto from "node:crypto";
import path from "node:path";

import { collectPluginSourceFiles } from "./collectPluginSourceFiles";

/**
 * The metadata signature of exactly the files a plugin source directory's
 * digest reads (`collectPluginSourceFiles`), each by its path relative to the
 * directory, and whether every stamp in it is separable, or `undefined` when a
 * listed file cannot be stated.
 *
 * A host that proves a plugin source often may keep the digest it read while
 * this signature holds still, as git keeps an index entry, and hand it to
 * `pluginSourceStateHolds` instead of reading every file again: a file added,
 * removed, renamed, or written moves the signature, provided each stamp's clock
 * tick had provably ended before the digest was read, so no later write can
 * reproduce it. What a stamp is, and whether its tick has ended, is the host's
 * to answer, since only the host owns a clock reference on the filesystem it
 * observes (`evidence`). The file list is ttsc's, so every host signs exactly
 * what the build keys on (samchon/ttsc#1492): `@ttsc/unplugin` keeps a digest
 * per delivery this way, and the capability-resolution cache across processes.
 *
 * @param directory The plugin source directory, absolute.
 * @param evidence One file's metadata signature and separability, or
 *   `undefined` when it cannot be stated.
 */
export function pluginSourceFilesSignature(
  directory: string,
  evidence: (
    file: string,
  ) => { separable: boolean; signature: string } | undefined,
): { separable: boolean; signature: string } | undefined {
  const hash = crypto.createHash("sha256");
  let separable = true;
  for (const file of collectPluginSourceFiles(directory)) {
    const observed = evidence(file);
    if (observed === undefined) return undefined;
    hash.update(`${path.relative(directory, file)}\0${observed.signature}\n`);
    separable &&= observed.separable;
  }
  return { separable, signature: hash.digest("hex") };
}
