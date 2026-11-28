import { isUtf8 } from "node:buffer";
import fs from "node:fs";

import { GoSourceInputs } from "./GoSourceInputs";
import { readPosixDirectoryEntries } from "./readPosixDirectoryEntries";

/**
 * Read source entries whose names can pass through the snapshot's string paths.
 * A contributing POSIX name must round-trip through UTF-8. Report the parent
 * and raw name bytes so the caller can rename the entry without spelling it as
 * a different, valid filename.
 *
 * @evidence contracts/common.md#principled-implementation POSIX readdir reports native bytes and kinds before any path is formed. The shared kind and name exclusions determine whether an invalid byte name is relevant.
 * @evidence contracts/common.md#clear-and-simple-design The source walk and materializer share one native name boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Valid UTF-8 containing U+FFFD is admitted and an unavailable byte spelling is never substituted with it.
 * @evidence contracts/common.md#meaningful-documentation States why the string boundary refuses a name and how the diagnostic identifies it.
 * @evidence contracts/portability.md#os-neutral-implementation Windows uses native string names. POSIX uses buffer names and a UTF-8 validity check before emitting strings.
 * @evidence contracts/performance.md#efficient-algorithms Checks entry name bytes in one pass. Node and Windows use typed listings, while Bun on POSIX classifies each byte name with lstat and checks the parent after a missing-component error.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each caller needs its own current entries.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The generator owns one temporary directory listing and no open handle.
 */
export function* readPluginSourceDirectory(directory: string) {
  if (process.platform === "win32") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }))
      yield { entry, name: entry.name };
    return;
  }
  for (const entry of readPosixDirectoryEntries(directory)) {
    const name = entry.name.toString("utf8");
    if (name.includes("\ufffd") && !isUtf8(entry.name)) {
      if (
        (entry.isDirectory() && !GoSourceInputs.shouldPruneDirectory(name)) ||
        (entry.isFile() && !GoSourceInputs.shouldOmitSourceFile(name)) ||
        (entry.isSymbolicLink() &&
          !GoSourceInputs.shouldPruneDirectory(name) &&
          !GoSourceInputs.shouldOmitSourceFile(name))
      )
        throw new Error(
          `ttsc: plugin source directory ${directory} contains a name that is not valid UTF-8 ` +
            `(hex ${entry.name.toString("hex")}). Rename the entry to build the plugin.`,
        );
      continue;
    }
    yield { entry, name };
  }
}
