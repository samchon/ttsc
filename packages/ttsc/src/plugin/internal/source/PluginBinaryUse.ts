import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createFilesystemPathIdentityContext } from "../../../internal/pathIdentity/createFilesystemPathIdentityContext";
import { PluginBuildLockOwner } from "./PluginBuildLockOwner";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/** Process-owned read reservations, one per returned binary cache key. */
const reservations = new Map<string, string>();

/**
 * Register reader reservations for returned executable paths until their
 * consumer process ends. Cooperating collectors preserve these records;
 * external deletion or replacement is not prevented by a token. Registration
 * and collection both run under the cache key's build lease. Reservations are
 * readers, not build generations: other readers can share the same executable
 * without holding that exclusive lease during execution.
 *
 * @evidence contracts/common.md#principled-implementation Per-key publication serializes with deletion while independent reader records preserve concurrent consumers through process lifetime.
 * @evidence contracts/common.md#clear-and-simple-design Registration, local reuse and collector liveness share one reservation representation, separate from builder-generation completion.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual native process absence authorizes collection; recency, elapsed time and completed builds do not establish that returned paths are unused.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the exclusive registration premise and distinguishes reader lifetime from producer completion.
 * @evidence contracts/portability.md#os-neutral-implementation Native directory metadata, hostname and signal-zero process observations supply ownership without OS-specific lifetime assumptions.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms Member operations own registration and inspection work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work holds and retain own process-local reservation reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources retain owns reservation lifetime and release.
 */
export namespace PluginBinaryUse {
  /**
   * Register this process under the key lease before its binary is returned.
   * One record serves repeated acquisitions of this same key until exit.
   *
   * @evidence contracts/common.md#principled-implementation Caller-held key ownership serializes reader publication with GC; hostname/PID-qualified records share one current-process reader across module instances without authorizing deletion by PID age.
   * @evidence contracts/common.md#clear-and-simple-design One reservation per physical key avoids per-call reader generations; process facts reuse the shared owner parser and liveness policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Publication failures throw rather than returning an unprotected path; no exit callback pretends the process has ended while later callbacks may still consume its binary.
   * @evidence contracts/common.md#meaningful-documentation Native prose states registration timing, held-lease premise and repeated-key reuse.
   * @evidence contracts/portability.md#os-neutral-implementation Node mkdir, lstat and UTF-8 owner records preserve native filesystem behavior; no shell or OS-wide case folding supplies ownership.
   * @evidence contracts/performance.md#efficient-algorithms A first key performs native identity resolution (after the initial holds query), scans U reader entries and owner JSON/path/hostname bytes, and writes one host/PID record. Dead-token removal also traverses their stored directory contents. Repeated keys still resolve identity and check token existence, without scanning unrelated keys; identity resolution includes its delegated native path and case-policy observations.
   * @evidence contracts/performance.md#reuse-equivalent-work A live process reuses one reader token for the same key, while other processes publish their own independent tokens.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One token and map entry remain per distinct physical key until process death; there is no constant key-count bound. Later admission or GC collects proven-dead tokens, while live, remote or unknown ownership is retained without an age bound; no native handle or exit hook remains installed.
   */
  export function retain(cacheDir: string): void {
    if (holds(cacheDir)) return;
    const identity = createFilesystemPathIdentityContext().resolve(cacheDir);
    const root = path.join(identity.path, ".binary-users");
    fs.mkdirSync(root, { recursive: true });
    const stats = fs.lstatSync(root);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`ttsc: invalid plugin binary reader directory: ${root}`);
    }
    hasLiveOwners(identity.path);
    const owner = { hostname: os.hostname(), pid: process.pid };
    const token = path.join(
      root,
      crypto
        .createHash("sha256")
        .update(JSON.stringify([owner.hostname.toLowerCase(), owner.pid]))
        .digest("hex"),
    );
    if (fs.existsSync(token)) {
      const previous = PluginBuildLockOwner.read(token);
      const stats = fs.lstatSync(token);
      if (
        !stats.isDirectory() ||
        stats.isSymbolicLink() ||
        previous?.pid !== owner.pid ||
        previous.hostname.toLowerCase() !== owner.hostname.toLowerCase()
      ) {
        throw new Error(
          `ttsc: invalid plugin binary reader ownership: ${token}`,
        );
      }
      reservations.set(identity.key, token);
      return;
    }
    fs.mkdirSync(token);
    try {
      fs.writeFileSync(
        path.join(token, PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_OWNER_FILE),
        JSON.stringify(owner),
        { flag: "wx", encoding: "utf8" },
      );
    } catch (error) {
      try {
        fs.rmSync(token, { recursive: true, force: true });
      } catch {}
      throw error;
    }
    reservations.set(identity.key, token);
  }

  /**
   * Whether the pathname of this process's previously published reader token
   * still exists. This permits local reuse under the cooperating cache-owner
   * premise; existence alone does not revalidate its kind, record or
   * incarnation.
   *
   * @evidence contracts/common.md#principled-implementation Only a pathname previously recorded by retain authorizes local reuse, and an absent pathname requires acquisition again. This existence query assumes cache ownership prevents external token replacement; it does not reread ownership or pin an incarnation.
   * @evidence contracts/common.md#clear-and-simple-design One process map and native existence observation answer the previously-owned-token question without interpreting other consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A recent use timestamp or matching binary filename cannot supply a missing reader reservation.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes previously published pathname existence from revalidation of token ownership.
   * @evidence contracts/portability.md#os-neutral-implementation Node observes the token path directly without platform-specific process enumeration.
   * @evidence contracts/performance.md#efficient-algorithms Delegated native cache-entry identity resolution includes path text and case-policy observations; one expected-constant map lookup and a token existence check avoid reader population scans. Hashing the identity key also depends on its string length.
   * @evidence contracts/performance.md#reuse-equivalent-work A repeated key reuses its process-owned token until it is absent or the process ends.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources retain owns the token and map lifetime; this query acquires no handle.
   */
  export function holds(cacheDir: string): boolean {
    const key = createFilesystemPathIdentityContext().resolve(cacheDir).key;
    const token = reservations.get(key);
    return token !== undefined && fs.existsSync(token);
  }

  /**
   * Preserve any live or unprovable reader while holding the deletion lease.
   * Only proven absent local processes authorize removal of their records.
   *
   * @evidence contracts/common.md#principled-implementation The caller's key lease excludes concurrent registration, and shared native liveness proves local absence; malformed, remote or unreadable ownership preserves the payload.
   * @evidence contracts/common.md#clear-and-simple-design One conservative reader scan shares the existing process-owner parser rather than treating producer completion as reader completion.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown ownership and linked/nonordinary reservation directories never authorize deletion; age and recency are not substituted for liveness.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines held-deletion-lease timing and exact absence requirements.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat directory kinds and the shared hostname/signal-zero process boundary supply conservative reclamation evidence.
   * @evidence contracts/performance.md#efficient-algorithms A scan visits U reader entries, their paths and JSON/hostname bytes, with at most one native liveness probe per valid record. Recursive deletion adds the contents of each dead token directory. Live owners do not stop scanning, but a native failure ends the scan conservatively, so later dead tokens may remain.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Reader population and liveness must be freshly observed under the collector's lease.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Proven-dead tokens are removed; failed deletion preserves the payload. The scan holds no process or filesystem handle after its synchronous calls.
   */
  export function hasLiveOwners(cacheDir: string): boolean {
    const root = path.join(cacheDir, ".binary-users");
    try {
      let stats: fs.Stats;
      try {
        stats = fs.lstatSync(root);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        return true;
      }
      if (!stats.isDirectory() || stats.isSymbolicLink()) return true;
      let protectedOwner = false;
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) {
          protectedOwner = true;
          continue;
        }
        const token = path.join(root, entry.name);
        const owner = PluginBuildLockOwner.read(token);
        if (owner === null || !PluginBuildLockOwner.gone(owner)) {
          protectedOwner = true;
        } else fs.rmSync(token, { recursive: true, force: true });
      }
      return protectedOwner;
    } catch {
      return true;
    }
  }
}
