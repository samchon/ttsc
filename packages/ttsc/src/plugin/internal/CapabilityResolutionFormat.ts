import crypto from "node:crypto";
import path from "node:path";

import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";
import { runtimeExecutableIdentity } from "../../internal/runtimeExecutableIdentity";
import type { PluginContentIdentities } from "./source/PluginContentIdentities";
import { SourceBuildCacheLayout } from "./source/SourceBuildCacheLayout";
import { resolveSourceBuildCachePaths } from "./source/resolveSourceBuildCachePaths";

/**
 * The on-disk format of the capability-resolution cache, shared by its reader
 * and writer so both agree on the entry's location and version tag. What proves
 * an entry still describes the project is the host inputs' states and the
 * plugin sources' states, each by the rule its producer applies; a plugin
 * source's metadata signature and the clock reference it is judged against
 * belong to `PluginContentIdentities`, which every cross-process plugin proof
 * shares.
 *
 * @evidence contracts/common.md#principled-implementation Reader and writer share format/key rules; source-metadata witnesses come from the shared identity owner, so this cache and the build path apply one separable-stamp rule.
 * @evidence contracts/common.md#clear-and-simple-design The namespace owns format identity and entry location, while entry acceptance, answer production and metadata witnesses stay with their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Version tags and NUL delimiters encode the persistence contract rather than guessed reuse.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains format evolution, unforgeable path separation and the witness owner in separate paragraphs; function/tag spacing follows the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path joins and cache-root resolution preserve OS-neutral filesystem behavior.
 * @evidence contracts/performance.md#efficient-algorithms Key construction orders and serializes environment/name bytes, streams runtime content and delegates native ancestor/manifest/cache-layout selection.
 * @evidence contracts/performance.md#reuse-equivalent-work Project/version keys share one answer across requested capabilities.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Cache entries belong to the source-cache pruning owner; this namespace retains nothing.
 */
export namespace CapabilityResolutionFormat {
  /**
   * Cache format tag.
   *
   * Moves when the entry shape or the validation rule changes, so an older
   * entry is discarded rather than read under new rules. The current format
   * proves the directories the binaries were keyed on by the build's own rule
   * and records only the answer of a load whose descriptors supplied the
   * explicit external-read declaration. This is a producer premise, not
   * detection of every omitted read. Its key includes the complete descriptor
   * environment and runtime content identity, since either can change a
   * factory's capability declarations. It requires an explicit completed
   * runtime observation envelope, so a partial side channel cannot authorize an
   * answer for reuse, and the shared module recorder's independent completion
   * proof, including its public require.resolve hook capability. Mapped import
   * candidates retain their pre-resolution witnesses; entries from before that
   * producer rule must be discovered again even when their later hashes match.
   */
  const FORMAT = "ttsc-capability-resolution-v7";

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
   * a second consumer can reuse that entry for another capability, while still
   * paying its authority and freshness checks. The complete environment and
   * runtime content proof distinguish evaluation authorities even when project
   * file content stays unchanged.
   *
   * @evidence contracts/common.md#principled-implementation SHA-256 over project/config identity, canonical descriptor environment and actual executable content/lexical/physical proof selects an authority-specific entry; unproved runtime/storage returns null rather than trusting restored metadata.
   * @evidence contracts/common.md#clear-and-simple-design Cache-root policy is delegated once and this function adds only the capability-entry key and layout.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The NUL separator prevents ambiguous path-field concatenation; fallback means uncached resolution rather than a guessed answer.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains null storage and project-wide reuse across capabilities; descriptive/tag separation follows the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation path.resolve/path.join and the source cache owner implement OS-neutral native path construction; runtime selection reads the supplied environment with Windows case-insensitive name semantics.
   * @evidence contracts/performance.md#efficient-algorithms Environment ordering has O(e log e) comparisons whose name bytes matter; full environment/path/identity text is serialized and hashed. Executable content uses a fixed read buffer, but native metadata/path and escaping identity text remain. Delegated root selection can walk ancestors/read manifests/inspect cache layout; no plugin-source directory scan is performed here.
   * @evidence contracts/performance.md#reuse-equivalent-work All capabilities for the same project identity use one entry because discovery computes their complete plugin set together.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The locator retains no handle or cache entry; its executable-proof owner attempts transient descriptor closure and refuses unproved observations on failure. Environment/serialized identity text is call-owned and the returned path does not pin future authority; persistence/pruning own stored lifetime.
   */
  export function resolutionFile(options: {
    /** Invocation directory included in the project-entry key. */
    cwd: string;

    /** Selected config identity supplied by capability discovery. */
    tsconfig: string;

    /** Effective environment selecting workspace-local or explicit storage. */
    env?: NodeJS.ProcessEnv;

    /**
     * Record store of the project's plugin cache. WARNING (#1725): without it
     * every lookup streamed the whole runtime executable, several times per
     * capability resolution, in every process.
     */
    identities?: PluginContentIdentities.Store;
  }): string | null {
    const environment = SidecarEnvironment.merge(options.env ?? process.env);
    const runtime =
      SidecarEnvironment.read(environment, "TTSC_NODE_BINARY") ??
      process.execPath;
    if (!path.isAbsolute(runtime)) return null;
    let root: string;
    let runtimeIdentity: string;
    try {
      const observed = runtimeExecutableIdentity(runtime, options.identities);
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
}
