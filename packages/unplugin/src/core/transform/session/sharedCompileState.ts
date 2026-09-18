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
