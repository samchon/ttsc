import path from "node:path";
import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { TtscProjectWalkFailure } from "../project/TtscProjectWalkFailure";
import { toProjectKey } from "../project/toProjectKey";
import { hashText } from "../utils/hashText";
import { walkSnapshotComplete } from "../validation/walkSnapshotComplete";

/** Hash the declared-input-relevant failure shape without retaining it. */
export function projectWalkFailureFingerprint(
  snapshot: {
    complete: boolean;
    directoryComplete: boolean;
    unstableFiles: ReadonlySet<string>;
    walkFailures: readonly TtscProjectWalkFailure[];
  },
  declared: ReadonlySet<string> | undefined,
  projectRoot: string,
  identities: FilesystemPathIdentityContext,
): string {
  const relevantUnstableFiles =
    declared === undefined
      ? [...snapshot.unstableFiles]
      : [...snapshot.unstableFiles].filter((key) => declared.has(key));
  const relevantFailures = snapshot.walkFailures.filter((failure) => {
    if (!failure.kind.startsWith("file-")) return true;
    if (declared === undefined) return true;
    try {
      return declared.has(toProjectKey(projectRoot, failure.path, identities));
    } catch {
      return true;
    }
  });
  return hashText(
    JSON.stringify({
      complete: walkSnapshotComplete(snapshot, declared),
      directoryComplete: snapshot.directoryComplete,
      failures: relevantFailures
        .map((failure) => `${failure.kind}\0${path.resolve(failure.path)}`)
        .sort(),
      unstableFiles: relevantUnstableFiles.sort(),
    }),
  );
}
