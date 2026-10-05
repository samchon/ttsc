import crypto from "node:crypto";
import path from "node:path";

import { PROJECT_SELECTION_ENTRIES } from "./PROJECT_SELECTION_ENTRIES";
import { readProjectMembershipPolicy } from "./readProjectMembershipPolicy";
import { readTsconfigReferences } from "./readTsconfigReferences";
import { readTsconfigSourceSnapshot } from "./readTsconfigSourceSnapshot";
import { resolveNativeRootPath } from "./resolveNativeRootPath";

/**
 * Read one config's root-file selection and `references`, reusing the memoized
 * entry while its observed config graph and identity spellings remain
 * unchanged. Failed realpath resolution can retain a lexical spelling.
 *
 * The stamp includes exact source content, the freshly resolved extends graph
 * and observed identity spelling. Metadata cannot detect same-stamp edits, and
 * old source paths alone cannot detect a package preset being installed or
 * redirected.
 *
 * A stamp taken only after the read could describe content written during the
 * read rather than the policy that was extracted. So an entry becomes reusable
 * only when the fresh graph stamp before a read equals the stamp taken after
 * it. A first read, or a read that saw a change, is stored unproven, and the
 * next call reads again.
 *
 * Separate filesystem reads are not an atomic snapshot: a source can change and
 * revert between observations. The transform generation owner separately
 * validates compiler inputs before accepting generated output.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A memo hit requires current graph/content/identity stamps to match a proven
 *   entry. Publication requires equal source lists and before/after stamps; first
 *   and changing reads remain unproven. Separate reads do not prove atomicity;
 *   generation validation still owns acceptance of compiler output.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This operation owns memo validation and publication; policy extraction,
 *   reference interpretation and source hashing have separate responsibilities.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native resolve names the config and fresh graph reads observe real sources.
 *   Native realpath contributes observed physical spelling to validity,
 *   including link target changes; its lexical fallback on resolution failure
 *   remains an unavailable-identity limitation, not a physical-name certificate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Fresh graph stamps replace mtime/size and old-resolution guesses; a read
 *   is not made reusable merely because it resembles a cached answer.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain metadata and preset-resolution changes, unproven
 *   first reads and the non-atomic observation limit, with reasons for memo states.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   PROJECT_SELECTION_ENTRIES owns strong entries for distinct lexical configs
 *   throughout the process lifetime. There is no eviction or fixed byte bound;
 *   each entry retains a policy, reference list and stamp, not an open file handle.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A hit freshly traverses, reads, sorts and hashes the config graph, including
 *   native resolution and source/path bytes, while avoiding policy extraction.
 *   A miss adds the policy reader's locally shared parsing, a separate reference
 *   read and another graph stamp; these phases do not share one transaction.
 *   sameFiles also compares the ordered source list. Exact current bytes and
 *   fresh resolution are needed because metadata and old paths cannot prove it.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Delivered modules share a policy/reference entry only while a fresh extends
 *   graph, source contents and observed identity spelling match the proven stamp. Newly
 *   installed or redirected presets change that graph and force new extraction.
 */
export function readProjectSelectionEntry(tsconfig: string): {
  policy: ReturnType<typeof readProjectMembershipPolicy>;
  references: readonly string[];
} {
  const key = path.resolve(tsconfig);
  const cached = PROJECT_SELECTION_ENTRIES.get(key);
  const before = cached === undefined ? undefined : stampOf(key);
  if (cached !== undefined && before === cached.stamp) return cached;
  const policy = readProjectMembershipPolicy(key);
  const references = readTsconfigReferences(key);
  const after = stampOf(key);
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

/** Hash the freshly resolved source graph, identities and unavailable states. */
function stampOf(tsconfig: string): string {
  const hash = crypto.createHash("sha256");
  for (const source of readTsconfigSourceSnapshot(tsconfig)) {
    hash.update(
      JSON.stringify([source.path, resolveNativeRootPath(source.path)]),
    );
    hash.update(
      source.contents === null
        ? "missing"
        : crypto.createHash("sha256").update(source.contents).digest("hex"),
    );
  }
  return hash.digest("hex");
}

/** Whether two reads reported the same files in the same order. */
function sameFiles(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((file, index) => file === right[index])
  );
}
