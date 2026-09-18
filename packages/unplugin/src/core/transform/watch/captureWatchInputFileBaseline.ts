import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { stableStringify } from "../utils/stableStringify";
import type { TtscWatchInputFileBaseline } from "./TtscWatchInputFileBaseline";

/** Capture the stable file predicate used by implicit project discovery. */
export function captureWatchInputFileBaseline(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): TtscWatchInputFileBaseline | undefined {
  const capture = (): TtscWatchInputFileBaseline => {
    const identities = createHostPathIdentityContext(filesystem);
    let fileExists = false;
    try {
      fileExists = filesystem.stat(file).isFile();
    } catch {
      // Project discovery rejects every candidate not proven to be a file.
    }
    return {
      fileExists,
      identity: pathIdentityKey(file, identities),
    };
  };
  try {
    const before = capture();
    const after = capture();
    return stableStringify(before) === stableStringify(after)
      ? after
      : undefined;
  } catch {
    return undefined;
  }
}
