import crypto from "node:crypto";

/**
 * This process's run key, which names the runtime directories it prepares: the
 * process id, so a person reading the cache can tell which process a directory
 * belongs to, followed by a nonce.
 *
 * A process id alone names a directory another run may hold too. A process of
 * another host sharing the cache root can have the same id, and a later process
 * given the id of one that was killed would claim the directory a sweep is
 * removing as abandoned (`ProcessOwnedDirectory.sweep`). The nonce lowers this
 * collision risk; a finite random identifier cannot guarantee uniqueness.
 * The memoized key belongs to this loaded module instance. Another instance or
 * worker can own another key even when Node reports the same process id.
 *
 * @returns The same key for every call to this module instance.
 *
 * @evidence contracts/common.md#principled-implementation Combining the diagnostic pid with a random 64-bit nonce distinguishes successive and cross-host runs that may share a pid; the identifier is probabilistic rather than a security credential.
 * @evidence contracts/common.md#clear-and-simple-design One module-local lazy value supplies its callers' run identity without caller-specific naming schemes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cryptographic randomness avoids a pid-only identity policy without certifying collision absence; the pid remains explanatory metadata rather than globally unique authority.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain shared-host/recycled-pid collision risk and finite randomness, and state module-instance stability without promising process-wide singleton identity.
 * @evidence contracts/performance.md#efficient-algorithms One eight-byte native random draw, hex encoding and native pid text initialize a fixed-size identifier; entropy acquisition can fail or add native latency. Cached access returns its stored string without another draw.
 * @evidence contracts/performance.md#reuse-equivalent-work Preparations using this loaded module share its identity; a new module instance obtains its own nonce rather than trusting a recycled pid alone.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One identifier remains per loaded module instance for its lifetime; repeated calls do not grow that slot, while module-instance populations and named-directory reclamation belong to their owners.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The reported pid is explanatory scalar text beside random hex, not a process-liveness or filesystem-identity authority. Native path construction, ownership probes and process lifecycle remain with callers.
 */
export function runtimeRunKey(): string {
  key ??= `${process.pid}-${crypto.randomBytes(8).toString("hex")}`;
  return key;
}

let key: string | undefined;
