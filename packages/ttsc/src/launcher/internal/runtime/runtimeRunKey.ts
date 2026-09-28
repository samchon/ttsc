import crypto from "node:crypto";

let key: string | undefined;

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
 */
export function runtimeRunKey(): string {
  key ??= `${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  return key;
}
