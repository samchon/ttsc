import crypto from "node:crypto";

/**
 * This process's run key, which names the runtime directories it prepares: the
 * process id, so a person reading the cache can tell which process a directory
 * belongs to, followed by a nonce.
 *
 * A process id alone names a directory another run may hold too. A process of
 * another host sharing the cache root can have the same id, and a later process
 * given the id of one that was killed would claim the directory a sweep is
 * removing as abandoned (`ProcessOwnedDirectory.sweep`). The nonce keeps every
 * run's directory its own (samchon/ttsc#1579).
 *
 * @returns The same key for every call in this process.
 *
 * @evidence contracts/common.md#principled-implementation Combining the diagnostic pid with a random 64-bit nonce distinguishes successive and cross-host runs that may share a pid; the identifier is probabilistic rather than a security credential.
 * @evidence contracts/common.md#clear-and-simple-design A single lazy value supplies every directory prepared by this process without caller-specific naming schemes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cryptographic randomness prevents pid-only reuse; the pid remains explanatory metadata rather than assumed globally unique authority.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain shared-host and recycled-pid hazards and state same-process stability explicitly.
 * @evidence contracts/performance.md#efficient-algorithms One fixed-size random draw initializes the key; subsequent accesses return the same string in O(1) time and space.
 * @evidence contracts/performance.md#reuse-equivalent-work All preparations in one process share the same run identity; a new process creates a fresh nonce rather than inheriting an old pid's key.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Exactly one small identifier is retained until process exit, while the directory owners separately reclaim the named runs.
 */
export function runtimeRunKey(): string {
  key ??= `${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  return key;
}

let key: string | undefined;
