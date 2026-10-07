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
 * removed or renamed changes the selected population, while content-write
 * detection relies on the owner's reported metadata and separability premises.
 * The signature itself does not read content or certify arbitrary metadata
 * restoration. What metadata/separability proves is the host's to answer, since
 * only the host owns a clock reference on the filesystem it observes
 * (`evidence`). The file list is ttsc's, so every host signs exactly what the
 * build keys on: `@ttsc/unplugin` keeps a digest per delivery this way, and the
 * capability-resolution cache across processes.
 *
 * @param directory The plugin source directory, absolute.
 * @param evidence One file's metadata signature and separability, or
 *   `undefined` when it cannot be stated.
 * @evidence contracts/common.md#principled-implementation Each selected file's relative path and caller-supplied metadata enter the signature, while all separability flags must hold; absent metadata rejects the proof rather than pretending an unreadable file is unchanged.
 * @evidence contracts/common.md#clear-and-simple-design The shared file population stays with ttsc while the observing owner supplies filesystem stamps and its clock-based separability judgment.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The function does not infer safe reuse from a quiet watcher or a convenient timestamp; the consumer must establish each stamp's separability.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains selected population changes and why metadata/separability premises and the evidence callback belong to the observing host, without equating this signature to content observation.
 * @evidence contracts/portability.md#os-neutral-implementation Native relative path spelling identifies files in this process; actual filesystem stamp precision and case capabilities are supplied by the observing owner.
 * @evidence contracts/performance.md#efficient-algorithms Sorted enumeration includes native listing/path-text comparison costs. Each file invokes caller evidence and hashes relative-path/metadata-signature JSON bytes; callback cost is the observer's work and cannot be bounded by F alone. This function does not reread file content, but retains the full selected path population during the walk.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This returns the validation signature; the consumer owns the digest and permission to reuse it against that signature.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned signature and separability value survive; the callback's external observation resources remain caller-owned.
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
    hash.update(
      JSON.stringify([path.relative(directory, file), observed.signature]),
    );
    separable &&= observed.separable;
  }
  return { separable, signature: hash.digest("hex") };
}
