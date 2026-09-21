import crypto from "node:crypto";
import path from "node:path";

import { MEMBERSHIP_DIGEST_DIRECTORY } from "./MEMBERSHIP_DIGEST_DIRECTORY";

/**
 * The file below a host's tool directory that carries one project's root-file
 * membership for the host's persistent cache (samchon/ttsc#1468).
 *
 * The compiler reports nothing about which files a tsconfig admits; the
 * adapter's own project walk decides it, and a watching session hands the host
 * the walk's digest through the bridge. A persistent cache is not a watching
 * session: a one-shot build that replays it, or a session started over it,
 * validates each module by the files it recorded, and a root file that appeared
 * while nothing ran changes no such file. This file is the membership as a
 * file: its content is the walk's digest, every module of the project depends
 * on it, the adapter rewrites it whenever the digest moves and refreshes it
 * before a host starts building (`refreshMembershipDigestFiles`), and the
 * host's own snapshot then decides.
 *
 * Its name is the tsconfig's path digested, so two projects below one host root
 * keep two files, and its record names the tsconfig, its root and its policy,
 * which is what a refresh needs to walk it again.
 *
 * @param toolDirectory The host's tool directory (`hostToolDirectory`).
 * @param tsconfig The project's tsconfig, as the adapter names it.
 */
export function membershipDigestFile(
  toolDirectory: string,
  tsconfig: string,
): string {
  const name = crypto
    .createHash("sha256")
    .update(path.resolve(tsconfig))
    .digest("hex")
    .slice(0, 32);
  return path.join(toolDirectory, MEMBERSHIP_DIGEST_DIRECTORY, `${name}.json`);
}
