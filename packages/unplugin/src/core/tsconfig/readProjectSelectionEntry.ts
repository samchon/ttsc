import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PROJECT_SELECTION_ENTRIES } from "./PROJECT_SELECTION_ENTRIES";
import { readProjectMembershipPolicy } from "./readProjectMembershipPolicy";
import { readTsconfigReferences } from "./readTsconfigReferences";

/**
 * Read one config's root-file selection and `references`, reusing the memoized
 * entry while none of the files it read has changed (samchon/ttsc#1397).
 *
 * The stamp is the content of those files, not their size and modification
 * time. An edit that keeps the size and lands within the clock tick of the
 * previous write, or a tool that restores the modification time, leaves the
 * metadata unchanged, and the stale selection would then route the file to the
 * wrong project until the process restarts.
 *
 * A stamp taken only after the read could describe content written during the
 * read, and the entry would be served stale for good. So an entry becomes
 * reusable only when the stamp taken before a read, over the files the previous
 * read reported, equals the stamp taken after it. A first read, or a read that
 * saw a change, is stored unproven, and the next call reads again.
 */
export function readProjectSelectionEntry(tsconfig: string): {
  policy: ReturnType<typeof readProjectMembershipPolicy>;
  references: readonly string[];
} {
  const key = path.resolve(tsconfig);
  const cached = PROJECT_SELECTION_ENTRIES.get(key);
  const before =
    cached === undefined ? undefined : stampOf([key, ...cached.policy.sources]);
  if (cached !== undefined && before === cached.stamp) return cached;
  const policy = readProjectMembershipPolicy(key);
  const references = readTsconfigReferences(key);
  const after = stampOf([key, ...policy.sources]);
  const entry = {
    policy,
    references,
    stamp:
      cached !== undefined &&
      sameFiles(cached.policy.sources, policy.sources) &&
      before === after
        ? after
        : undefined,
  };
  PROJECT_SELECTION_ENTRIES.set(key, entry);
  return entry;
}

/** SHA-256 of each file's bytes, or its absence. */
function stampOf(files: readonly string[]): string {
  return files
    .map((file) => {
      try {
        return crypto
          .createHash("sha256")
          .update(fs.readFileSync(file))
          .digest("hex");
      } catch {
        return "missing";
      }
    })
    .join("|");
}

/** Whether two reads reported the same files in the same order. */
function sameFiles(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((file, index) => file === right[index])
  );
}
