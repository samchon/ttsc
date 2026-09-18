import type { ITtscCompilerTransformation } from "ttsc";
import { resolveFilesystemPath } from "ttsc/path-identity";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/** Replay TypeScript-Go's Realpath result, including its lexical fallback. */
export function compilerInputRealpathObservation(
  file: string,
  filesystem: TtscTransformFilesystemOperations,
): NonNullable<ITtscCompilerTransformation.IInputObservation["realpath"]> {
  try {
    const realpath = filesystem.realpath(file);
    return realpath.length === 0
      ? { ok: false }
      : {
          ok: true,
          path: resolveFilesystemPath(realpath, filesystem.platform),
        };
  } catch {
    // TypeScript-Go's OS and io filesystems return the cleaned input spelling
    // when native realpath resolution fails; they do not expose the failure.
    return {
      ok: true,
      path: resolveFilesystemPath(file, filesystem.platform),
    };
  }
}
