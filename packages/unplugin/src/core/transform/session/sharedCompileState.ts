import crypto from "node:crypto";

import type { TtscProjectDirectorySnapshot } from "../project/TtscProjectDirectorySnapshot";

/**
 * Hex digest of the project state a compile reads, from the snapshot a worker
 * takes before compiling (samchon/ttsc#1390).
 *
 * It encodes supplied file hash entries, relevant directory path/signature
 * records and the caller's tsconfig-state signature. Capture supplies a complete
 * before-walk snapshot before making a shared claim. Irrelevant directory
 * records are omitted by their recorded relevance flag, not by an output name.
 * This truncated key does not establish snapshot completeness or stability
 * itself: publication and adoption retain those proof responsibilities. Inputs outside the walk,
 * such as the reference graph's and the plugins' own inputs, are not in the
 * digest: the envelope records their compile-time state, and the adopter proves
 * it against the filesystem as it would its own compile's.
 *
 * @evidence contracts/common.md#principled-implementation Sorted file keys and relevant directory addresses stream distinct file/directory records with their recorded hash/signature values after the config signature. The actual producer supplies native names without NUL and scalar hashes/signatures; this is a projection key, not standalone completeness or current-state proof. External inputs retain separate adoption validation.
 * @evidence contracts/common.md#clear-and-simple-design The digest streams the three existing snapshot components and filters only directories the membership policy already classified as irrelevant.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No output-directory name is guessed here and a matching digest does not replace the publisher's stability or adopter's external-input proof.
 * @evidence contracts/common.md#meaningful-documentation The comment defines the digest's included and excluded inputs and why both publication and adoption still require proof.
 * @evidence contracts/performance.md#efficient-algorithms Object.keys materializes and sorts F file keys; filtering scans all D directory records before sorting R relevant paths. Key/path comparisons and each streamed config/key/hash/signature frame pay text/UTF-8 encoding and hash work. Temporary key/filter arrays follow F and R, and each update constructs a frame string; no source byte contents or full serialized snapshot is copied. The returned key retains 32 hex characters.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure snapshot digest coordinates no cache or in-flight computation; producer and adopter owners decide when matching state permits sharing a compile.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Ordering arrays and the hash object remain local; the digest transfers to the caller and no historical snapshot, handle or task is retained.
 * @evidence contracts/portability.md#os-neutral-implementation File keys and directory addresses remain exactly as the native snapshot producer recorded them; sorting and framing add no case folding, separator conversion or physical alias equality. Sharing requires comparable captured address domains from the caller, and this encoding performs no new native identity observation or filesystem read.
 */
export function sharedCompileState(props: {
  directories: readonly TtscProjectDirectorySnapshot[];
  hashes: Readonly<Record<string, string>>;
  tsconfigSignature: string;
}): string {
  const hash = crypto.createHash("sha256");
  hash.update(`${props.tsconfigSignature}\n`);
  for (const key of Object.keys(props.hashes).sort()) {
    hash.update(`f\0${key}\0${props.hashes[key]}\n`);
  }
  for (const directory of props.directories
    .filter((directory) => directory.relevant)
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    )) {
    hash.update(`d\0${directory.path}\0${directory.signature}\n`);
  }
  return hash.digest("hex").slice(0, 32);
}
