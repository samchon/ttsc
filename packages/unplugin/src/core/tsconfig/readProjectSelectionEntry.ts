import fs from "node:fs";
import path from "node:path";

import { PROJECT_SELECTION_ENTRIES } from "./PROJECT_SELECTION_ENTRIES";
import { readProjectMembershipPolicy } from "./readProjectMembershipPolicy";
import { readTsconfigReferences } from "./readTsconfigReferences";

/**
 * Read one config's root-file selection and `references`, reusing the memoized
 * entry while none of the files it read has changed (samchon/ttsc#1397).
 */
export function readProjectSelectionEntry(tsconfig: string): {
  policy: ReturnType<typeof readProjectMembershipPolicy>;
  references: readonly string[];
} {
  const key = path.resolve(tsconfig);
  const cached = PROJECT_SELECTION_ENTRIES.get(key);
  if (
    cached !== undefined &&
    stampOf([key, ...cached.policy.sources]) === cached.stamp
  ) {
    return cached;
  }
  const policy = readProjectMembershipPolicy(key);
  const entry = {
    policy,
    references: readTsconfigReferences(key),
    stamp: stampOf([key, ...policy.sources]),
  };
  PROJECT_SELECTION_ENTRIES.set(key, entry);
  return entry;
}

/** Size and modification time of each file, or its absence. */
function stampOf(files: readonly string[]): string {
  return files
    .map((file) => {
      try {
        const stats = fs.statSync(file, { bigint: true });
        return `${stats.size}:${stats.mtimeNs}`;
      } catch {
        return "missing";
      }
    })
    .join("|");
}
