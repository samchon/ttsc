import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";
import { runtimeExecutableIdentity } from "../../internal/runtimeExecutableIdentity";
import { SourceBuildCacheLayout } from "./source/SourceBuildCacheLayout";
import { resolveSourceBuildCachePaths } from "./source/resolveSourceBuildCachePaths";

/**
 * The on-disk format of the capability-resolution cache, shared by its reader
 * and writer so both agree on the entry's location, version tag, and how a
 * plugin source's metadata signature is taken. What proves an entry still
 * describes the project is the host inputs' states and the plugin sources'
 * states, each by the rule its producer applies.
 *
 * @evidence contracts/common.md#principled-implementation Reader and writer share the exact format/key and source-metadata witness rules; only ended clock ticks on the same device can accelerate the authoritative source-state proof.
 * @evidence contracts/common.md#clear-and-simple-design The namespace owns format identity and witness construction, while entry acceptance and answer production stay with their reader/writer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Version tags and NUL delimiters encode the persistence contract; unavailable clock/device evidence causes full content proof rather than guessed reuse.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains format evolution, unforgeable path separation and clock proof premises in separate paragraphs; function/tag spacing follows the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path joins, cache-root resolution and bigint stat device identities preserve OS-neutral filesystem behavior; clock witnesses are matched per device rather than assumed from platform names.
 * @evidence contracts/performance.md#efficient-algorithms Key construction orders environment data and streams actual runtime bytes through the shared fixed-buffer proof; each source witness needs one metadata read and source-content proof remains with its owner.
 * @evidence contracts/performance.md#reuse-equivalent-work Project/version keys share one answer across requested capabilities; digest reuse additionally requires matching signature and device-clock separation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Clock probes are call-owned and removed in finally; cache entries belong to the source-cache pruning owner rather than a process-global answer collection. Failed probe removal can leave a small file and is best effort.
 */
export namespace CapabilityResolutionFormat {
  /**
   * Cache format tag.
   *
   * Moves when the entry shape or the validation rule changes, so an older
   * entry is discarded rather than read under new rules. The second format
   * proves the directories the binaries were keyed on by the build's own rule,
   * where the first fingerprinted each plugin's `source` alone
   * (samchon/ttsc#1492). The third records only the answer of a load whose
   * descriptors declared every file they read (samchon/ttsc#1561). The fourth
   * includes the complete descriptor environment and runtime content identity
   * in the key, since either can change a factory's capability declarations.
   * The fifth additionally requires an explicit completed runtime observation
   * envelope; a partial side channel cannot authorize an answer for reuse. The
   * sixth also requires the shared module recorder's independent completion
   * proof, including its public require.resolve hook capability.
   */
  const FORMAT = "ttsc-capability-resolution-v6";

  /**
   * The character that joins fields a path could otherwise forge.
   *
   * A path cannot contain it, which is the whole reason it is the separator:
   * with a space, a file named `a 1 2` states the same string as a one-byte
   * file named `a`, and an edit to either would read as no edit at all. Built
   * rather than written literally, because a source file carrying a raw NUL is
   * one Git classifies as binary — which silently exempts it from this
   * repository's end-of-line contract and leaves it with no textual diff for a
   * reviewer.
   */
  const SEPARATOR = String.fromCharCode(0);

  /**
   * The version string an entry records: the format tag joined with the ttsc
   * version, so a ttsc upgrade invalidates every entry written by another one.
   *
   * @evidence contracts/common.md#principled-implementation Joining the format revision and product version rejects entries written under a different producer or validation contract.
   * @evidence contracts/common.md#clear-and-simple-design A shared function prevents reader and writer from constructing competing version identities.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The revision literal is cache protocol identity rather than an expected fixture version.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states the version-change invalidation effect, with descriptive and acknowledgment paragraphs separated under the documentation skill.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This pure cache-version string has no native path, process or platform interpretation; namespace filesystem operations own that obligation.
   *
   * @evidence contracts/performance.md#efficient-algorithms One concatenation constructs a string proportional to the supplied version length, without intermediate parsing.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure identity formatter owns no expensive computation cache or reusable attempt.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It returns caller-owned text and acquires no retained population or resource.
   */
  export function formatVersion(version: string): string {
    return `${FORMAT}:${version}`;
  }

  /**
   * Where the entry for this project lives, or `null` when no cache root can be
   * resolved or the descriptor runtime cannot be identified.
   *
   * Keyed on the project rather than on the capability: the walk it replaces
   * discovers every configured plugin, so one entry answers for all of them and
   * a second consumer asking about a different capability costs nothing. The
   * complete environment and runtime content proof distinguish evaluation
   * authorities even when project file content stays unchanged.
   *
   * @evidence contracts/common.md#principled-implementation SHA-256 over project/config identity, canonical descriptor environment and actual executable content/lexical/physical proof selects an authority-specific entry; unproved runtime/storage returns null rather than trusting restored metadata.
   * @evidence contracts/common.md#clear-and-simple-design Cache-root policy is delegated once and this function adds only the capability-entry key and layout.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The NUL separator prevents ambiguous path-field concatenation; fallback means uncached resolution rather than a guessed answer.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains null storage and project-wide reuse across capabilities; descriptive/tag separation follows the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation path.resolve/path.join and the source cache owner implement OS-neutral native path construction; runtime selection reads the supplied environment with Windows case-insensitive name semantics.
   * @evidence contracts/performance.md#efficient-algorithms Environment ordering costs O(e log e), while current executable content is streamed in O(B) time with fixed-buffer space; the key needs no plugin-source directory scan.
   * @evidence contracts/performance.md#reuse-equivalent-work All capabilities for the same project identity use one entry because discovery computes their complete plugin set together.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The locator retains no handle or cache entry; its shared executable-proof owner releases the transient descriptor before return, while persistence/pruning retain their own storage responsibilities.
   */
  export function resolutionFile(options: {
    /** Invocation directory included in the project-entry key. */
    cwd: string;

    /** Selected config identity supplied by capability discovery. */
    tsconfig: string;

    /** Effective environment selecting workspace-local or explicit storage. */
    env?: NodeJS.ProcessEnv;
  }): string | null {
    const environment = SidecarEnvironment.merge(options.env ?? process.env);
    const runtime =
      SidecarEnvironment.read(environment, "TTSC_NODE_BINARY") ??
      process.execPath;
    if (!path.isAbsolute(runtime)) return null;
    let root: string;
    let runtimeIdentity: string;
    try {
      const observed = runtimeExecutableIdentity(runtime);
      if (observed === undefined) return null;
      runtimeIdentity = observed;
      root = resolveSourceBuildCachePaths(
        path.resolve(options.cwd),
        undefined,
        environment,
      ).root;
    } catch {
      return null;
    }
    const key = crypto
      .createHash("sha256")
      .update(path.resolve(options.cwd))
      .update(SEPARATOR)
      .update(options.tsconfig)
      .update(SEPARATOR)
      .update(
        JSON.stringify(
          Object.entries(environment)
            .filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            )
            .sort(([left], [right]) =>
              left < right ? -1 : left > right ? 1 : 0,
            ),
        ),
      )
      .update(SEPARATOR)
      .update(runtimeIdentity)
      .digest("hex");
    return path.join(
      root,
      SourceBuildCacheLayout.CAPABILITY_CACHE_DIRNAME,
      `${key}.json`,
    );
  }

  /**
   * A clock reference for plugin source signatures, minted by a write of the
   * cache's own beside the entry: the modification stamp a fresh probe file got
   * there, by the device that reported it.
   *
   * A stamp strictly older than its device's reference lies in a clock tick
   * that has provably ended, so any later write to that file mints a newer one
   * and moves the signature; git's rule for an index entry that is not racily
   * clean. The probe is the cache's own file, named for this call, and removed
   * at once, so concurrent readers never lend each other a reference. A failed
   * write, or a plugin source on another device, leaves nothing separable, and
   * the proof reads the files.
   *
   * @param entry The entry file, whose directory the probe is written in.
   *
   * @evidence contracts/common.md#principled-implementation A unique freshly-written file supplies its device's completed clock reference; failure clears the witness so later metadata proof cannot claim separation.
   * @evidence contracts/common.md#clear-and-simple-design The function returns only device-to-stamp evidence and owns its transient probe from creation through cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Random probe identity avoids borrowing a concurrent call's witness; failed acquisition does not substitute wall-clock guesses for device evidence.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains ended ticks, cross-device refusal and probe lifetime in separate paragraphs; tag separation follows the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native joins and bigint lstat use the actual filesystem's device/stamp values; no fixed timestamp precision or OS-specific temp path is assumed.
   * @evidence contracts/performance.md#efficient-algorithms One small write and metadata query produce a witness independent of plugin source size.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each proof needs a fresh clock reference; sharing an earlier probe would defeat the rollback/separation premise.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The unique call-owned probe is removed in finally even after acquisition failure; removal is best effort and the returned map contains at most its single observed device.
   */
  export function clockReference(entry: string): ReadonlyMap<bigint, bigint> {
    const references = new Map<bigint, bigint>();
    const probe = path.join(
      path.dirname(entry),
      `clock-${process.pid}-${crypto.randomUUID()}.probe`,
    );
    try {
      fs.mkdirSync(path.dirname(probe), { recursive: true });
      fs.writeFileSync(probe, `${process.hrtime.bigint()}\n`);
      const stats = fs.lstatSync(probe, { bigint: true });
      references.set(stats.dev, stats.mtimeNs);
    } catch {
      references.clear();
    } finally {
      try {
        fs.rmSync(probe, { force: true });
      } catch {
        // A probe left behind is an empty file of the cache's own.
      }
    }
    return references;
  }

  /**
   * One plugin source file's metadata signature, and whether its stamp is
   * separable from `reference`, for `pluginSourceFilesSignature`.
   *
   * The files the digest reads are regular files (`collectPluginSourceFiles`),
   * so the file's own metadata is its whole state: a write, a replacement, or a
   * write through another hard link moves the size, the stamps, or the file
   * id.
   *
   * @param reference The clock reference minted for this proof.
   *
   * @evidence contracts/common.md#principled-implementation lstat device/inode/link/mode/size/timestamps distinguish a regular source file's metadata state, and strict mtime-before-reference establishes its tick ended before this proof.
   * @evidence contracts/common.md#clear-and-simple-design A closure carries one proof's device references and maps each requested file to signature/separation together.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable files return no witness, and unmatched device or same/newer stamps cannot authorize digest reuse.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states the regular-file premise and reference origin, with separate acknowledgment prose following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Metadata comes from native bigint lstat and actual device IDs; separators join numeric fields only and no host path is manually parsed.
   * @evidence contracts/performance.md#efficient-algorithms Each invocation performs one metadata query and formats a fixed field count rather than reading content bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work The closure reuses one reference map across files in the same proof, while each file's current metadata is read anew.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned closure retains only the caller's bounded reference map; no file handle or global source population is retained.
   */
  export function sourceEvidence(
    reference: ReadonlyMap<bigint, bigint>,
  ): (file: string) => { separable: boolean; signature: string } | undefined {
    return (file) => {
      try {
        const stats = fs.lstatSync(file, { bigint: true });
        const minted = reference.get(stats.dev);
        return {
          separable: minted !== undefined && stats.mtimeNs < minted,
          signature: [
            stats.dev,
            stats.ino,
            stats.nlink,
            stats.mode,
            stats.size,
            stats.mtimeNs,
            stats.ctimeNs,
          ].join(":"),
        };
      } catch {
        return undefined;
      }
    };
  }
}
