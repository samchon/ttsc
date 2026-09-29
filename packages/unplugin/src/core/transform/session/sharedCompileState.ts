import crypto from "node:crypto";

import type { TtscProjectDirectorySnapshot } from "../project/TtscProjectDirectorySnapshot";

/**
 * Hex digest of the project state a compile reads, from the snapshot a worker
 * takes before compiling (samchon/ttsc#1390).
 *
 * It covers the content of every file the project walk reached, the listing of
 * every directory that can hold a program input, which decides membership, and
 * the tsconfig chain's state. A directory that cannot, such as a bundler's
 * output directory, is left out exactly as the membership proof leaves it out,
 * or workers would stop matching the moment the bundler writes. A publisher
 * publishes a compile under this digest only after proving the same snapshot
 * held for the whole compile. So a worker whose own snapshot has the same
 * digest reads exactly the state that compile read. Inputs outside the walk,
 * such as the reference graph's and the plugins' own inputs, are not in the
 * digest: the envelope records their compile-time state, and the adopter proves
 * it against the filesystem as it would its own compile's.
 *
 * @evidence contracts/common.md#principled-implementation Sorted file hashes, relevant directory membership signatures, and tsconfig state identify the walked compile input; external inputs retain their separate adoption proof.
 * @evidence contracts/common.md#clear-and-simple-design The digest streams the three existing snapshot components and filters only directories the membership policy already classified as irrelevant.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No output-directory name is guessed here and a matching digest does not replace the publisher's stability or adopter's external-input proof.
 * @evidence contracts/common.md#meaningful-documentation The comment defines the digest's included and excluded inputs and why both publication and adoption still require proof.
 * @evidence contracts/performance.md#efficient-algorithms File keys and relevant directory records are each sorted once, then streamed into one hash; temporary memory holds ordering arrays rather than a serialized copy of the full content snapshot.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure snapshot digest coordinates no cache or in-flight computation; producer and adopter owners decide when matching state permits sharing a compile.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Ordering arrays and the hash object remain local; the digest transfers to the caller and no historical snapshot, handle or task is retained.
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
