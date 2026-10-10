import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { E2ETrace } from "../../../internal/E2ETrace";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { pluginBuildVersions } from "./pluginBuildVersions";
import { pluginSourceCovers } from "./pluginSourceCovers";
import { pluginSourceDigest } from "./pluginSourceDigest";
import { pluginSourceFilesSignature } from "./pluginSourceFilesSignature";
import { recordCacheFileUse } from "./recordCacheFileUse";
import { resolveSourceBuildCachePaths } from "./resolveSourceBuildCachePaths";

/**
 * Content identities a plugin load proves from metadata instead of bytes, kept
 * in the plugin cache root so they outlive the process that read them.
 *
 * WARNING (#1721, #1722, #1723): a warm plugin load must not pay for its inputs'
 * bytes. Before this owner existed, every launch, every `ttsx` process, every
 * `@ttsc/unplugin` worker and the build-environment worker re-read the plugin
 * module, the ttsc overlays, the whole GOROOT and the Go and JavaScript
 * runtimes, because each earlier fix (#1186, #1712) kept its reuse inside one
 * process. A process is not the unit of reuse: a CLI launch is one process. Any
 * new content identity on the load path belongs here, and a memo that only
 * lives in module state is not a fix for this class.
 *
 * A record pairs the digest of a selected population with the metadata
 * signature of that population, and is trusted only under the separable-stamp
 * rule settled by #1227 and #1344: every stamp must be strictly older than a
 * reference minted on the same device by this store's own write, so no later
 * write can share a recorded tick. A record is written only when the signature
 * observed before the content read equals the one observed after it and both
 * are separable. Reuse still assumes the filesystem reports writes in its
 * metadata (identity, size, modification and change times); change time moves
 * on every write and cannot be restored by an ordinary process. A population on
 * a device without a reference, an unseparable stamp, a missing or foreign
 * record, or any observation failure falls back to reading content, exactly as
 * before this owner.
 *
 * Records live in single-file cache parts (`SourceBuildCacheLayout`), so the
 * opportunistic collector ages them out and `ttsc clean` removes them. Their
 * identity includes the record format and the ttsc version, so a release that
 * changes a digest rule never reads another release's records.
 *
 * @evidence contracts/common.md#principled-implementation Metadata stands for recorded content only under the established separable-stamp rule, with before/after agreement around the content read; every unproved premise falls back to the content reader.
 * @evidence contracts/common.md#clear-and-simple-design One store owns opening, record identity, reuse and publication; callers supply only the population observation and the content reader they already own.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No path-only or process-permanent memo stands for content; failures and unseparable stamps cause the real read rather than a guessed digest.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the regression this owner prevents, the proof premises, the fallback and the storage lifetime.
 * @evidence contracts/portability.md#os-neutral-implementation References are keyed by the native device that minted them and stamps are compared per device; no timestamp precision or platform name is assumed.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups operations; each member states its own work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Members define the reuse identity and its validity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Members define what they retain; the namespace holds no state.
 */
export namespace PluginContentIdentities {
  /**
   * One opened record store: the physical cache root and the clock reference
   * minted when it was opened.
   *
   * @evidence contracts/common.md#principled-implementation The reference is minted by this store's own write before any observation it judges, so stamps strictly older than it cannot share a later write's tick.
   * @evidence contracts/common.md#clear-and-simple-design Root, reference and version travel together so every record of one load is judged against one minted reference and one product version.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The record stores observed state, not an expected digest.
   * @evidence contracts/common.md#meaningful-documentation Members document their provenance and lifetime.
   * @evidence contracts/portability.md#os-neutral-implementation The reference map is keyed by native device identifiers.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A record type runs no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type grants no reuse by itself; digest owns it.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The opener owns the store for one load or one build; at most one device reference is retained.
   */
  export interface Store {
    /** Physical cache root that holds the identity and answer parts. */
    readonly root: string;

    /**
     * Modification stamp of a probe written by this store, by device. A stamp
     * on a device absent here is never separable.
     */
    readonly references: ReadonlyMap<bigint, bigint>;

    /** Ttsc package version entering every record identity. */
    readonly version: string;
  }

  /**
   * One population's metadata signature and whether every stamp in it is
   * separable from the store's reference.
   *
   * @evidence contracts/common.md#principled-implementation Signature and separability are observed together from the same metadata reading.
   * @evidence contracts/common.md#clear-and-simple-design Two fields carry exactly what digest compares and admits.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The signature is never treated as content; only the paired record digest is.
   * @evidence contracts/common.md#meaningful-documentation Members state their meaning.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The observer that builds it owns native metadata semantics.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A record type runs no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type grants no reuse by itself.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns its short lifetime.
   */
  export interface Observation {
    /** Whether every stamp precedes the reference of its own device. */
    readonly separable: boolean;

    /** Metadata signature of the whole selected population. */
    readonly signature: string;
  }

  /**
   * Open the store under a plugin cache root and mint its clock reference, or
   * return `undefined` when the root cannot hold records, so callers read
   * content as they did without one.
   *
   * The root follows the plugin cache policy (`resolveSourceBuildCachePaths`):
   * an explicit `cacheDir`, `TTSC_CACHE_DIR`, or the workspace-local default.
   * A default root is marked as selected before its first write, as every
   * other default writer does, so a later root search never mistakes the new
   * payload for an older orphan.
   *
   * A root inside any of `sources` is refused before anything is written: the
   * build rejects such a cache (`SourcePluginAdmission`), and a record written
   * there would change the very source it describes.
   *
   * @param props.projectRoot Project whose cache root is selected.
   * @param props.cacheDir Explicit caller cache root, when one was given.
   * @param props.env Effective environment selecting `TTSC_CACHE_DIR`.
   * @param props.sources Plugin source directories the root must lie outside.
   * @evidence contracts/common.md#principled-implementation The plugin cache policy selects the root, default roots are marked before payload, and the reference comes from a fresh owned probe; any failure withholds the store so callers keep the content path.
   * @evidence contracts/common.md#clear-and-simple-design Root policy and the probe are delegated to their existing owners; this function composes them once per load.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No wall clock or historical stamp substitutes for the minted reference.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs state root selection, the marker ordering and the undefined fallback.
   * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and the probe's device identity carry platform semantics; Windows environment names are read case-insensitively by the shared reader.
   * @evidence contracts/performance.md#efficient-algorithms Root selection can walk ancestors and read manifests; the probe performs one directory creation, one write, one lstat and one removal. No plugin source is read.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each load needs a freshly minted reference; reusing an older one would defeat the separation premise.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The probe is removed in its owner's finally; the returned store retains one device reference and two strings.
   */
  export function open(props: {
    projectRoot: string;
    cacheDir?: string;
    env: NodeJS.ProcessEnv;
    sources?: readonly string[];
  }): Store | undefined {
    try {
      const selected = resolveSourceBuildCachePaths(
        props.projectRoot,
        props.cacheDir,
        props.env,
      ).root;
      if (coversRoot(selected, props.sources ?? [])) return undefined;
      const root =
        props.cacheDir || SidecarEnvironment.read(props.env, "TTSC_CACHE_DIR")
          ? selected
          : SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(selected);
      const references = mintReference(
        path.join(root, SourceBuildCacheLayout.IDENTITY_CACHE_DIRNAME),
      );
      if (references.size === 0) return undefined;
      return {
        root,
        references,
        version: pluginBuildVersions(props.projectRoot).ttsc,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * The store when its root lies outside every one of `sources`, otherwise
   * `undefined`. A loader opens its store before descriptor evaluation names
   * the plugin sources, then narrows it here before any source is proven, so a
   * misplaced cache, which the build rejects, never receives records inside a
   * user's source tree.
   *
   * @param store The opened store, if any.
   * @param sources Plugin source directories the root must lie outside.
   * @evidence contracts/common.md#principled-implementation The build's own containment predicate (`pluginSourceCovers`) decides, so a root below a pruned directory is admitted exactly as the build admits it.
   * @evidence contracts/common.md#clear-and-simple-design One predicate shared by open and late narrowing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A covered root withdraws persistence rather than writing into a source.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains the two-phase opening.
   * @evidence contracts/portability.md#os-neutral-implementation Containment uses native path grammar.
   * @evidence contracts/performance.md#efficient-algorithms One relative-path check per source.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A predicate over current arguments.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
   */
  export function outside(
    store: Store | undefined,
    sources: readonly string[],
  ): Store | undefined {
    return store === undefined || coversRoot(store.root, sources)
      ? undefined
      : store;
  }

  /**
   * The digest of one population: the recorded one while its metadata still
   * holds and is separable, otherwise a fresh content reading, recorded when
   * its metadata held still and separable around the read.
   *
   * A population whose selection would include the store's own root is never
   * recorded, since writing a record would change what it describes; a root
   * below a pruned directory such as `node_modules` is outside every selection.
   *
   * @param store The opened store, or `undefined` to read content only.
   * @param kind Population family; records of different families never mix.
   * @param subject Absolute population path identifying the record.
   * @param observe Current signature of the population against references.
   * @param read The owning content reader; its result is the digest.
   * @evidence contracts/common.md#principled-implementation A record is used only when the current separable signature equals the recorded one; publication requires equal separable signatures before and after the actual content read.
   * @evidence contracts/common.md#clear-and-simple-design The caller keeps population selection and content hashing; this function owns only lookup, admission and publication.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Corrupt, foreign or unproved records cause the real read; the record cannot widen what the caller's reader covers.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the reuse condition and the self-containment exclusion; parameters describe their roles.
   * @evidence contracts/portability.md#os-neutral-implementation Separability is the observer's per-device judgement; record files use native path joins and atomic same-directory replacement.
   * @evidence contracts/performance.md#efficient-algorithms A hit costs one population observation and one small record read; a miss adds the content read and a second observation. Record identity hashes fixed framing text.
   * @evidence contracts/performance.md#reuse-equivalent-work Processes share a digest only for the same family, subject, version and current separable signature that the producing read was bracketed by.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One small file per subject is published atomically and aged out by the single-file collector; hits refresh its use time; nothing is retained in memory.
   */
  export function digest(
    store: Store | undefined,
    kind: string,
    subject: string,
    observe: (references: ReadonlyMap<bigint, bigint>) => Observation | undefined,
    read: () => string,
  ): string {
    if (
      store === undefined ||
      pluginSourceCovers(subject, store.root, "directory")
    )
      return read();
    const file = recordFile(store, kind, subject);
    const before = observe(store.references);
    if (before?.separable === true) {
      const known = readRecord(file);
      if (
        known !== undefined &&
        known.signature === before.signature &&
        known.version === store.version &&
        known.kind === kind &&
        known.subject === subject
      ) {
        recordCacheFileUse(file);
        E2ETrace.capabilityResolution("plugin-content-identity", {
          kind,
          subject,
          outcome: "reused",
        });
        return known.digest;
      }
    }
    const value = read();
    const after = observe(store.references);
    const recorded =
      before?.separable === true &&
      after?.separable === true &&
      before.signature === after.signature;
    if (recorded) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        SourceBuildCacheLayout.replaceCacheMetadataFile(
          file,
          JSON.stringify({
            format: FORMAT,
            version: store.version,
            kind,
            subject,
            signature: after.signature,
            digest: value,
          } satisfies IRecord),
        );
      } catch {
        // A record is an optimization; the digest just read stands.
      }
    }
    E2ETrace.capabilityResolution("plugin-content-identity", {
      kind,
      subject,
      outcome: recorded ? "recorded" : "read",
    });
    return value;
  }

  /**
   * The `pluginSourceDigest` of a plugin source directory, proven from the
   * metadata of exactly the files that digest reads.
   *
   * @param store The opened store, or `undefined` to read content only.
   * @param directory The source directory.
   * @evidence contracts/common.md#principled-implementation The signature walks the same `collectPluginSourceFiles` population the digest reads, with the capability cache's separable-stamp evidence; additions, removals and renames change that population.
   * @evidence contracts/common.md#clear-and-simple-design Selection and hashing remain with their owners; this adapter only names the family and subject.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Links and unreadable files fail as the content reader would; no metadata stands for a file the digest does not read.
   * @evidence contracts/common.md#meaningful-documentation Native prose names the shared population.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat device/inode/link/mode/size/stamps form each file's signature.
   * @evidence contracts/performance.md#efficient-algorithms A hit enumerates and stats F files without reading content; a miss also reads B bytes and stats again.
   * @evidence contracts/performance.md#reuse-equivalent-work Loads in any process share a directory digest while its separable signature holds.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Storage belongs to digest.
   */
  export function sourceDirectory(
    store: Store | undefined,
    directory: string,
  ): string {
    const resolved = path.resolve(directory);
    return digest(
      store,
      "plugin-source",
      resolved,
      (references) =>
        pluginSourceFilesSignature(resolved, sourceEvidence(references)),
      () => pluginSourceDigest(resolved),
    );
  }

  /**
   * One regular file's metadata signature, following links, and whether its
   * stamp is separable; `undefined` when it cannot be stated.
   *
   * @param references The store's device references.
   * @param file The file, normally already resolved to its physical path.
   * @evidence contracts/common.md#principled-implementation Device, inode, mode, size and both stamps move on replacement or write; separability requires a same-device reference strictly newer than the modification stamp.
   * @evidence contracts/common.md#clear-and-simple-design One stat produces both fields used by digest.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A non-regular or unreadable file yields no observation, so the content reader decides.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the following-link semantics and undefined meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Node bigint stat supplies native identity and nanosecond stamps.
   * @evidence contracts/performance.md#efficient-algorithms One native stat and fixed numeric formatting.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This is a fresh observation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
   */
  export function fileObservation(
    references: ReadonlyMap<bigint, bigint>,
    file: string,
  ): Observation | undefined {
    try {
      const stats = fs.statSync(file, { bigint: true });
      if (!stats.isFile()) return undefined;
      return {
        separable: separable(references, stats),
        signature: [
          stats.dev,
          stats.ino,
          stats.mode,
          stats.size,
          stats.mtimeNs,
          stats.ctimeNs,
        ].join(":"),
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Whether a stamp is strictly older than the reference its device minted.
   *
   * @param references The store's device references.
   * @param stats Observed metadata.
   * @evidence contracts/common.md#principled-implementation Only a strictly newer same-device reference separates the recorded modification tick.
   * @evidence contracts/common.md#clear-and-simple-design One lookup and one comparison.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing reference is never replaced by wall time.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the strict ordering.
   * @evidence contracts/portability.md#os-neutral-implementation References are matched by native device identifier.
   * @evidence contracts/performance.md#efficient-algorithms One map lookup and one bigint comparison.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A scalar predicate.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
   */
  export function separable(
    references: ReadonlyMap<bigint, bigint>,
    stats: fs.BigIntStats,
  ): boolean {
    const minted = references.get(stats.dev);
    return minted !== undefined && stats.mtimeNs < minted;
  }

  /**
   * A clock reference minted by a write of the cache's own: the modification
   * stamp a fresh probe file got in `directory`, by the device that reported it.
   *
   * A stamp strictly older than the same device's fresh reference satisfies the
   * separation policy. Reuse still assumes the filesystem's reported metadata
   * reflects writes; the comparison cannot certify arbitrary timestamp
   * restoration or future clock behavior. The probe is the cache's own file,
   * named for this call, and removal is attempted at once, so concurrent readers
   * never lend each other a reference. A failed write, or a population on
   * another device, leaves nothing separable, and the proof reads the files.
   *
   * @param directory Cache-owned directory the probe is written in.
   * @evidence contracts/common.md#principled-implementation A unique freshly-written file supplies its native device/mtime reference; acquisition failure clears the witness, and observers require a matching device and strictly older reported stamp under the metadata policy.
   * @evidence contracts/common.md#clear-and-simple-design The function returns only device-to-stamp evidence and owns its transient probe from creation through cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Random probe identity avoids borrowing a concurrent call's witness; failed acquisition does not substitute wall-clock guesses for device evidence.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains ended ticks, cross-device refusal and probe lifetime in separate paragraphs; tag separation follows the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native joins and bigint lstat use the actual filesystem's device/stamp values; no fixed timestamp precision or OS-specific temp path is assumed.
   * @evidence contracts/performance.md#efficient-algorithms Probe path/UUID/hrtime text construction and mkdir/write/lstat/removal queries produce a witness without reading any population bytes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each proof needs a fresh clock reference; sharing an earlier probe would defeat the rollback/separation premise.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The unique call-owned probe is removed in finally even after acquisition failure; removal is best effort and the returned map contains at most its single observed device.
   */
  export function mintReference(
    directory: string,
  ): ReadonlyMap<bigint, bigint> {
    const references = new Map<bigint, bigint>();
    const probe = path.join(
      directory,
      `clock-${process.pid}-${crypto.randomUUID()}.probe`,
    );
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(probe, `${process.hrtime.bigint()}\n`);
      const stats = fs.lstatSync(probe, { bigint: true });
      references.set(stats.dev, stats.mtimeNs);
    } catch {
      references.clear();
    } finally {
      try {
        fs.rmSync(probe, { force: true });
      } catch {
        // A leftover probe contains this call's hrtime text, not source data.
      }
    }
    return references;
  }

  /**
   * One plugin source file's metadata signature, and whether its stamp is
   * separable from `references`, for `pluginSourceFilesSignature`.
   *
   * The files the digest reads are regular files (`collectPluginSourceFiles`),
   * so these fields are the observer's metadata signature. Native metadata
   * reflecting a write/replacement is a reuse premise; the signature is not
   * itself a content hash or proof against arbitrary timestamp restoration.
   *
   * @param references The clock references minted for this proof.
   * @evidence contracts/common.md#principled-implementation lstat device/inode/link/mode/size/timestamps form the regular-file metadata signature; strict mtime-before-reference marks separation for a matching device under the native metadata policy, without observing content.
   * @evidence contracts/common.md#clear-and-simple-design A closure carries one proof's device references and maps each requested file to signature/separation together.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unreadable files return no witness, and unmatched device or same/newer stamps cannot authorize digest reuse.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states the regular-file premise and reference origin, with separate acknowledgment prose following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Metadata comes from native bigint lstat and actual device IDs; separators join numeric fields only and no host path is manually parsed.
   * @evidence contracts/performance.md#efficient-algorithms Each invocation performs native path/lstat work and formats seven bigint fields without reading content.
   * @evidence contracts/performance.md#reuse-equivalent-work The closure reuses one reference map across files in the same proof, while each file's current metadata is read anew.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The closure retains the supplied reference map until its consumer releases it; no file handle or global population is retained.
   */
  export function sourceEvidence(
    references: ReadonlyMap<bigint, bigint>,
  ): (file: string) => { separable: boolean; signature: string } | undefined {
    return (file) => {
      try {
        const stats = fs.lstatSync(file, { bigint: true });
        return {
          separable: separable(references, stats),
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

  /**
   * Record format tag. Move it whenever the record shape or the meaning of a
   * family's digest changes; the ttsc version already separates releases.
   */
  const FORMAT = "ttsc-content-identity-v1";

  interface IRecord {
    format: string;
    version: string;
    kind: string;
    subject: string;
    signature: string;
    digest: string;
  }

  function coversRoot(root: string, sources: readonly string[]): boolean {
    const resolved = path.resolve(root);
    return sources.some((source) =>
      pluginSourceCovers(path.resolve(source), resolved, "directory"),
    );
  }

  function recordFile(store: Store, kind: string, subject: string): string {
    const key = crypto
      .createHash("sha256")
      .update(JSON.stringify([FORMAT, store.version, kind, subject]))
      .digest("hex");
    return path.join(
      store.root,
      SourceBuildCacheLayout.IDENTITY_CACHE_DIRNAME,
      `${key}.json`,
    );
  }

  function readRecord(file: string): IRecord | undefined {
    try {
      const value = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<IRecord>;
      return value.format === FORMAT &&
        typeof value.version === "string" &&
        typeof value.kind === "string" &&
        typeof value.subject === "string" &&
        typeof value.signature === "string" &&
        typeof value.digest === "string"
        ? (value as IRecord)
        : undefined;
    } catch {
      return undefined;
    }
  }
}
