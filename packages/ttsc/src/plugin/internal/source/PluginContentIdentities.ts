import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { E2ETrace } from "../../../internal/E2ETrace";
import { systemTempOutsideProject } from "../../../internal/systemTempOutsideProject";
import type { IPluginSourceListing } from "./IPluginSourceListing";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { pluginSourceCovers } from "./pluginSourceCovers";
import { pluginSourceDigest } from "./pluginSourceDigest";
import { pluginSourceFilesSignature } from "./pluginSourceFilesSignature";
import { recordCacheFileUse } from "./recordCacheFileUse";
import { resolveSourceBuildCachePaths } from "./resolveSourceBuildCachePaths";
import { ttscPackageVersion } from "./ttscPackageVersion";

/**
 * Content identities a plugin load proves from metadata instead of bytes, kept
 * in the plugin cache root so they outlive the process that read them.
 *
 * WARNING (#1721, #1722, #1723): a warm plugin load must not pay for its
 * inputs' bytes. Before this owner existed, every launch, every `ttsx` process,
 * every `@ttsc/unplugin` worker and the build-environment worker re-read the
 * plugin module, the ttsc overlays, the whole GOROOT and the Go and JavaScript
 * runtimes, because each earlier fix (#1186, #1712) kept its reuse inside one
 * process. A process is not the unit of reuse: a CLI launch is one process. Any
 * new content identity on the load path belongs here, and a memo that only
 * lives in module state is not a fix for this class.
 *
 * A record pairs the digest of a selected population with the metadata
 * signature of that population, and is trusted only under the separable-stamp
 * rule settled by #1227 and #1344: every stamp must be strictly older than a
 * reference minted on the same device by this store's own write, so no later
 * write can share a recorded tick. References are minted on the cache root's
 * volume and on the system temporary directory's volume, which together hold
 * the project, its plugins and toolchain, and a system-installed runtime. A
 * record is written only when the signature observed before the content read
 * equals the one observed after it and both are separable. Reuse still assumes
 * the filesystem reports writes in its metadata (identity, size, modification
 * and change times); change time moves on every write and cannot be restored by
 * an ordinary process.
 *
 * A valid Nix store path is immutable: Nix never changes its content in place,
 * and replacing it deletes and recreates its top directory, giving that
 * directory a new inode and change time. For populations confined to their
 * subject (`plugin-source` and `executable`), a subject whose real path lies
 * inside a direct child of the store root (`NIX_STORE_DIR` or `/nix/store`)
 * named with a 32-character Nix base32 hash, whose top directory has no write
 * bits and is owned by the store root's owner, is observed from its store path,
 * real path, and top directory's device, inode and change time without walking
 * the population or needing a clock reference on the store volume. Any other
 * case, including unconfined populations such as `goroot`, a population on a
 * device without a reference, an unseparable stamp, a missing or foreign
 * record, or any observation failure, falls back to reading content, exactly as
 * before this owner.
 *
 * Records live in single-file cache parts (`SourceBuildCacheLayout`), so the
 * opportunistic collector ages them out and `ttsc clean` removes them. Their
 * identity includes the record format and the ttsc version, so a release that
 * changes a digest rule never reads another release's records.
 *
 * @evidence contracts/common.md#principled-implementation Metadata stands for recorded content only under the established separable-stamp rule or, for confined kinds inside a read-only owner-matched Nix store path, the immutable store-path identity, with before/after agreement around the content read; every unproved premise falls back to the content reader.
 * @evidence contracts/common.md#clear-and-simple-design One store owns opening, Nix store-root discovery, record identity, reuse and publication; callers supply only the population observation and the content reader they already own.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No path-only or process-permanent memo stands for content; look-alike store paths, unconfined kinds, failures and unseparable stamps take the metadata walk or real read rather than a guessed digest.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the regression this owner prevents, the separable-stamp and Nix store-path proof premises, the fallback and the storage lifetime.
 * @evidence contracts/portability.md#os-neutral-implementation References are keyed by the native device that minted them and stamps are compared per device; Nix store-path qualification uses native realpath and POSIX owner/mode capabilities when present without assuming a platform name or timestamp precision.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups operations; each member states its own work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Members define the reuse identity and its validity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Members define what they retain; the namespace holds no state.
 */
export namespace PluginContentIdentities {
  /**
   * One opened record store: the physical cache root, the clock references
   * minted when it was opened, and the physical Nix store root when present.
   *
   * @evidence contracts/common.md#principled-implementation The reference is minted by this store's own write before any observation it judges, so stamps strictly older than it cannot share a later write's tick; the optional Nix store root pairs its resolved path with its owner uid once at open time.
   * @evidence contracts/common.md#clear-and-simple-design Root, references, listings, optional Nix store root and version travel together so every record of one load is judged against the state observed when the store opened and one product version.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The record stores observed state, not an expected digest.
   * @evidence contracts/common.md#meaningful-documentation Members document their provenance and lifetime.
   * @evidence contracts/portability.md#os-neutral-implementation The reference map is keyed by native device identifiers, and Nix store metadata uses native realpath and bigint uid when supported.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A record type runs no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type grants no reuse by itself; digest owns it.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The opener owns the store for one load or one build; at most two device references and one optional Nix store root pair are retained.
   */
  export interface Store {
    /** Physical cache root that holds the identity and answer parts. */
    readonly root: string;

    /**
     * Modification stamp of a probe written by this store, by device. A stamp
     * on a device absent here is never separable.
     */
    readonly references: ReadonlyMap<bigint, bigint>;

    /**
     * Devices on which this store's probe moved its directory's stamps, so a
     * directory's stamps there witness its entries (`IPluginSourceListing`).
     */
    readonly listings: ReadonlySet<bigint>;

    /**
     * Physical Nix store root and its owner uid when the store root exists as a
     * directory; absent otherwise.
     */
    readonly nixStore?: { readonly root: string; readonly uid: bigint };

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
   * Open the store under a plugin cache root and mint its cache-volume clock
   * reference, or return `undefined` when the root cannot hold records, so
   * callers read content as they did without one.
   *
   * The root follows the plugin cache policy (`resolveSourceBuildCachePaths`):
   * an explicit `cacheDir`, `TTSC_CACHE_DIR`, or the workspace-local default. A
   * default root is marked as selected before its first write, as every other
   * default writer does, so a later root search never mistakes the new payload
   * for an older orphan. One reference is minted in the root's identity
   * directory, and the store exists only when that write succeeds. A second
   * reference can come from a validated system temporary directory outside the
   * project, on a volume the cache root does not cover. The store attempts it
   * once, when a proof needs another device or a caller requests the reference
   * before compilation via {@link ensureTemporaryReference}.
   *
   * A root inside any of `sources` is refused before anything is written: the
   * build rejects such a cache (`SourcePluginAdmission`), and a record written
   * there would change the very source it describes. The Nix store root
   * (`NIX_STORE_DIR` from `env`, or `/nix/store`) is resolved once to its real
   * path and owner uid when it exists as a directory.
   *
   * @param props.projectRoot Project whose cache root is selected.
   * @param props.cacheDir Explicit caller cache root, when one was given.
   * @param props.env Effective environment selecting `TTSC_CACHE_DIR` and
   *   `NIX_STORE_DIR`.
   * @param props.sources Plugin source directories the root must lie outside.
   * @evidence contracts/common.md#principled-implementation The root is marked before its first default write and an owned probe provides its reference. Cross-device proofs lazily mint a second reference with owned precedence and union listing semantics. The optional Nix store identity uses the real directory and its owner.
   * @evidence contracts/common.md#clear-and-simple-design Root selection, Nix store lookup and probe creation delegate to their existing owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No wall clock or historical stamp substitutes for the minted reference.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe root selection, marker ordering, the lazy probe, Nix store resolution and the undefined fallback.
   * @evidence contracts/portability.md#os-neutral-implementation Native paths and device identities carry filesystem semantics. Environment names use the shared reader and Nix store ownership requires POSIX uid support.
   * @evidence contracts/performance.md#efficient-algorithms Opening mints one owned probe and reads no plugin source. The optional second attempt validates the temporary root, its device and directory owner before it writes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each load needs a freshly minted reference; reusing an older one would defeat the separation premise.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each probe is removed in its owner's finally and the empty per-user temporary directory remains stable across loads. The store retains at most two device references and one optional Nix store root pair. The private WeakMap entry drops with the store.
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
      const owned = mint(
        path.join(root, SourceBuildCacheLayout.IDENTITY_CACHE_DIRNAME),
      );
      if (owned.references.size === 0) return undefined;
      // The cache root's device covers the project, its installed plugins and
      // the toolchain bundled with them. A runtime or SDK installed elsewhere,
      // typically on the system drive, is judged against a second reference
      // minted lazily in a per-user directory below the system temporary
      // directory only when a proof meets a device absent from owned.references.
      let temporaryMinted = false;
      const references = new (class extends Map<bigint, bigint> {
        public override get(device: bigint): bigint | undefined {
          if (!owned.references.has(device)) ensureTemporary();
          return super.get(device);
        }

        public override has(device: bigint): boolean {
          if (!owned.references.has(device)) ensureTemporary();
          return super.has(device);
        }
      })(owned.references);
      const listings = new (class extends Set<bigint> {
        public override has(device: bigint): boolean {
          if (!owned.references.has(device)) ensureTemporary();
          return super.has(device);
        }
      })(owned.listings);
      const ensureTemporary = (): void => {
        if (temporaryMinted) return;
        temporaryMinted = true;
        const temporary = temporaryReference(
          props.projectRoot,
          owned.references,
        );
        for (const [device, stamp] of temporary.references) {
          // Keep owned precedence over temporary on the same device.
          if (!Map.prototype.has.call(references, device)) {
            Map.prototype.set.call(references, device, stamp);
          }
        }
        for (const device of temporary.listings) {
          Set.prototype.add.call(listings, device);
        }
      };
      const nixStore = resolveNixStore(props.env);
      // WARNING (#1726): resolve no module here. A descriptor evaluator opens a
      // store under its resolution recorder, and any lookup becomes an input of
      // the descriptor it did not read (`ttscPackageVersion`).
      const store: Store = {
        root,
        references,
        listings,
        ...(nixStore === undefined ? {} : { nixStore }),
        version: ttscPackageVersion(),
      };
      temporaryMinters.set(store, ensureTemporary);
      return store;
    } catch {
      return undefined;
    }
  }

  /**
   * Explicitly mint the store's temporary-volume clock reference now, at most
   * once per store.
   *
   * Callers that snapshot `store.references` before a compile to prove later
   * post-compile or parked traces (`RuntimeBuildInputs`) call this before the
   * compile starts so any cross-volume reference predates the compile.
   *
   * @param store The opened store, if any.
   * @evidence contracts/common.md#principled-implementation Forces the store's own temporary-volume probe ahead of a bracketed compile without minting a second probe when already minted.
   * @evidence contracts/common.md#clear-and-simple-design One explicit entry point triggers the store's lazy temporaryReference closure without exposing internal mutable maps.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Mints a real probe through temporaryReference rather than synthesizing a timestamp or reusing a past store's probe.
   * @evidence contracts/common.md#meaningful-documentation States why pre-compile callers invoke this explicitly and its at-most-once semantics.
   * @evidence contracts/portability.md#os-neutral-implementation Delegates directly to the store's native temporaryReference probe.
   * @evidence contracts/performance.md#efficient-algorithms Constant-time WeakMap lookup plus at most one temporary-volume probe per store; no-op on subsequent calls.
   * @evidence contracts/performance.md#reuse-equivalent-work Idempotent per store; once minted, subsequent calls and cross-device lookups reuse that store's reference.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retains no additional state beyond the store's WeakMap entry, which releases when the store is dropped.
   */
  export function ensureTemporaryReference(store: Store | undefined): void {
    if (store !== undefined) temporaryMinters.get(store)?.();
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
   * below a pruned directory such as `node_modules` is outside every
   * selection.
   *
   * When the store opened with a Nix store root and `kind` is confined to its
   * subject (`plugin-source`, where `collectPluginSourceFiles` rejects links,
   * and `executable`, a single real-pathed regular file), a subject whose real
   * path lies inside a direct child of that root named `<32 Nix base32
   * chars>-<name>` whose top directory has no write bit (`mode & 0o222 === 0`)
   * and is owned by the store root's owner is observed directly from its store
   * path, real path, and top directory's `dev:ino:ctimeNs` instead of calling
   * `observe`. Nix never edits a store path in place and recreating it changes
   * its inode and change time; including the subject's real path invalidates a
   * link retargeted to another subdirectory of the same store path, and the
   * signature is prefixed so it never equals a metadata-walk signature.
   * Unconfined kinds such as `goroot` keep the caller's `observe` path because
   * `walkGoRootIdentity` follows symlinks, so a link reaching outside the store
   * path would go unwitnessed.
   *
   * @param store The opened store, or `undefined` to read content only.
   * @param kind Population family; records of different families never mix.
   * @param subject Absolute population path identifying the record.
   * @param observe Current signature of the population against references,
   *   given the listing the record holds, if any; an observer that lists its
   *   population returns the listing for the record.
   * @param read The owning content reader; its result is the digest.
   * @evidence contracts/common.md#principled-implementation A record is used only when the current separable signature equals the recorded one; publication requires equal separable signatures before and after the actual content read. A recorded listing only shortens how the observer reaches the current signature, and a Nix store-path observation replaces the walk only for confined kinds whose real path lies inside a read-only owner-matched store directory.
   * @evidence contracts/common.md#clear-and-simple-design The caller keeps population selection and content hashing; this function owns lookup, confined Nix store-path admission, reuse and publication in one place.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Corrupt or foreign records and unseparable observations cause the real read. Unconfined kinds and paths outside the admitted store layout use the caller's observer. The store path proof assumes the selected store preserves descendant contents.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the reuse condition, the self-containment exclusion, the Nix store-path premise and the `goroot` exclusion; parameters describe their roles.
   * @evidence contracts/portability.md#os-neutral-implementation Separability is the observer's per-device judgement or a POSIX realpath/lstat Nix store check; record files use native path joins and atomic same-directory replacement.
   * @evidence contracts/performance.md#efficient-algorithms A Nix store hit costs one realpath, one lstat and one small record read without walking or reading the population. An ordinary hit uses one population observation, which a held listing makes metadata-only. A miss adds the content read and checks again only when the initial observation was separable. Record identity hashes fixed framing text.
   * @evidence contracts/performance.md#reuse-equivalent-work Processes share a digest only for the same family, subject, version and current separable signature (or confined Nix store-path identity) that the producing read was bracketed by, and an observer's listing with it.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One small file per subject is published atomically and aged out by the single-file collector; hits refresh its use time, or rewrite it once with the listing their walk read; nothing is retained in memory.
   */
  export function digest(
    store: Store | undefined,
    kind: string,
    subject: string,
    observe: (
      references: ReadonlyMap<bigint, bigint>,
      listing?: IPluginSourceListing,
    ) =>
      | (Observation & { readonly listing?: IPluginSourceListing })
      | undefined,
    read: () => string,
  ): string {
    if (
      store === undefined ||
      pluginSourceCovers(subject, store.root, "directory")
    )
      return read();
    const file = recordFile(store, kind, subject);
    const known = readRecord(file);
    const before =
      nixStoreObservation(store, kind, subject) ??
      observe(store.references, known?.listing);
    if (before?.separable === true) {
      if (
        known !== undefined &&
        known.signature === before.signature &&
        known.version === store.version &&
        known.kind === kind &&
        known.subject === subject
      ) {
        // A walk that could state every directory leaves the listing it read,
        // so a record written where the premise was not yet shown, or whose
        // listing moved without changing the population, is replayed next time.
        if (before.listing !== undefined && before.listing !== known.listing)
          try {
            SourceBuildCacheLayout.replaceCacheMetadataFile(
              file,
              JSON.stringify({
                ...known,
                listing: before.listing,
              } satisfies IRecord),
            );
          } catch {
            // The record still stands; only the next proof walks again.
          }
        else recordCacheFileUse(file);
        E2ETrace.capabilityResolution("plugin-content-identity", {
          kind,
          subject,
          outcome: "reused",
        });
        return known.digest;
      }
    }
    const value = read();
    // Only a separable pre-read observation can authorize publication; skip the
    // post-read observation when the record cannot be written anyway.
    const after =
      before?.separable === true
        ? (nixStoreObservation(store, kind, subject) ??
          observe(store.references))
        : undefined;
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
            ...(after.listing === undefined ? {} : { listing: after.listing }),
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
   * The record keeps the population's listing (`IPluginSourceListing`), so a
   * later proof states its directories' stamps instead of enumerating them: a
   * source tree of thousands of files took seconds to enumerate on every plugin
   * load and a single metadata pass to replay (samchon/ttsc#1852).
   *
   * @param store The opened store, or `undefined` to read content only.
   * @param directory The source directory.
   * @evidence contracts/common.md#principled-implementation The signature walks, or replays a recorded listing of, the same `collectPluginSourceFiles` population the digest reads, with the capability cache's separable-stamp evidence; additions, removals and renames change that population and the stamps of the directory they happen in.
   * @evidence contracts/common.md#clear-and-simple-design Selection and hashing remain with their owners; this adapter only names the family and subject and supplies the store's evidence.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Links and unreadable files fail as the content reader would; no metadata stands for a file the digest does not read, and a directory whose stamps moved is listed again.
   * @evidence contracts/common.md#meaningful-documentation Native prose names the shared population and the listing kept with it.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat device/inode/link/mode/size/stamps form each file's and directory's signature; directory stamps witness entries only on a device the store saw move them.
   * @evidence contracts/performance.md#efficient-algorithms A hit with a held listing stats D directories and F files without listing or reading; a hit without one enumerates D directories; a miss also reads B bytes and walks again.
   * @evidence contracts/performance.md#reuse-equivalent-work Loads in any process share a directory digest while its separable signature holds, and its listing while its directories' stamps do.
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
      (references, known) =>
        pluginSourceFilesSignature(resolved, sourceEvidence(references), {
          directory: directoryEvidence(references, store!.listings),
          known,
        }),
      () => pluginSourceDigest(resolved),
    );
  }

  /**
   * One directory's metadata signature when its stamps witness its entries: on
   * a device that moved a directory's stamps when the store created an entry,
   * with both stamps strictly older than that device's reference.
   *
   * @param references The store's device references.
   * @param listings The store's devices whose directory stamps move.
   * @evidence contracts/common.md#principled-implementation Device, inode, mode, link count and both stamps identify the directory and its last entry change; only a device that showed the premise and stamps whose tick ended before the reference are offered.
   * @evidence contracts/common.md#clear-and-simple-design One closure carries one proof's references, as sourceEvidence does for files.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A non-directory, a failure, an unknown device or an unseparable stamp yields no witness, so the population is enumerated; a link is stated only together with the directory it names.
   * @evidence contracts/common.md#meaningful-documentation Native prose states both conditions of a witness.
   * @evidence contracts/portability.md#os-neutral-implementation Native bigint lstat supplies the device, identity and nanosecond stamps; the premise is per device.
   * @evidence contracts/performance.md#efficient-algorithms One native lstat, a second stat for a link, and fixed formatting per directory.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A fresh observation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The closure retains the supplied maps only.
   */
  export function directoryEvidence(
    references: ReadonlyMap<bigint, bigint>,
    listings: ReadonlySet<bigint>,
  ): (directory: string) => string | undefined {
    const stated = (stats: fs.BigIntStats): string | undefined =>
      listings.has(stats.dev) && separable(references, stats, true)
        ? [
            stats.dev,
            stats.ino,
            stats.mode,
            stats.nlink,
            stats.mtimeNs,
            stats.ctimeNs,
          ].join(":")
        : undefined;
    return (directory) => {
      try {
        const entry = fs.lstatSync(directory, { bigint: true });
        // A source root reached through a link, as a package manager installs
        // one, is stated by the link and by the directory it names, so a
        // retarget moves the first and an entry change the second.
        const target = entry.isSymbolicLink()
          ? fs.statSync(directory, { bigint: true })
          : entry;
        if (!target.isDirectory()) return undefined;
        const own = stated(entry);
        if (own === undefined || target === entry) return own;
        const named = stated(target);
        return named === undefined ? undefined : `${own}>${named}`;
      } catch {
        return undefined;
      }
    };
  }

  /**
   * One regular file's metadata signature, following links, and whether its
   * stamp is separable; `undefined` when it cannot be stated.
   *
   * @param references The store's device references.
   * @param file The file, normally already resolved to its physical path.
   * @param separateChangeTime Also require the change stamp to precede the
   *   reference for selected runtime source-content reuse.
   * @evidence contracts/common.md#principled-implementation Device, inode, mode, size and both stamps move on replacement or write; separability requires a same-device reference strictly newer than the modification stamp and, when requested, the change stamp.
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
    separateChangeTime = false,
  ): Observation | undefined {
    try {
      return statObservation(
        references,
        fs.statSync(file, { bigint: true }),
        separateChangeTime,
      );
    } catch {
      return undefined;
    }
  }

  /**
   * The observation {@link fileObservation} makes, from metadata the caller
   * already read; `undefined` when it does not describe a regular file.
   *
   * A caller that needs a file's metadata for another decision, such as whether
   * the entry is a link, states the observation from that same reading instead
   * of asking the filesystem twice.
   *
   * @param references The store's device references.
   * @param stats Metadata of the file, following links.
   * @param separateChangeTime Also require the change stamp to precede the
   *   reference.
   * @evidence contracts/common.md#principled-implementation The signature and separability are functions of one metadata reading, so a caller's reading and this observation cannot describe different states of the file.
   * @evidence contracts/common.md#clear-and-simple-design fileObservation delegates here; the signature has one definition.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A non-regular entry yields no observation, so the content reader decides.
   * @evidence contracts/common.md#meaningful-documentation Native prose states why a caller supplies its own reading and the undefined meaning.
   * @evidence contracts/portability.md#os-neutral-implementation Node bigint metadata supplies native identity and nanosecond stamps.
   * @evidence contracts/performance.md#efficient-algorithms Fixed numeric formatting of one reading; no filesystem request.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A projection of supplied metadata.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
   */
  export function statObservation(
    references: ReadonlyMap<bigint, bigint>,
    stats: fs.BigIntStats,
    separateChangeTime = false,
  ): Observation | undefined {
    if (!stats.isFile()) return undefined;
    return {
      separable: separable(references, stats, separateChangeTime),
      signature: [
        stats.dev,
        stats.ino,
        stats.mode,
        stats.size,
        stats.mtimeNs,
        stats.ctimeNs,
      ].join(":"),
    };
  }

  /**
   * Where a record of `kind` about `subject` lives in the store, for an owner
   * that keeps its own record shape beside the digest records.
   *
   * The location carries the record format, the ttsc version, the family and
   * the subject, so families and releases never read each other's files, and it
   * lies in the collected identity directory with every other record.
   *
   * @param store The opened store.
   * @param kind Record family; it must differ from every digest family.
   * @param subject Absolute path the record describes.
   * @evidence contracts/common.md#principled-implementation One keyed location per family and subject, shared with digest records, keeps every identity record under the same collection and cleaning policy.
   * @evidence contracts/common.md#clear-and-simple-design The private locator is exposed unchanged rather than duplicated by a second owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The family name separates record shapes; no shape is guessed from a file's content.
   * @evidence contracts/common.md#meaningful-documentation Native prose states what the location encodes and who collects it.
   * @evidence contracts/portability.md#os-neutral-implementation Native path joins under the store's physical root.
   * @evidence contracts/performance.md#efficient-algorithms One hash of fixed framing text.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure function of its arguments.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
   */
  export function recordLocation(
    store: Store,
    kind: string,
    subject: string,
  ): string {
    return recordFile(store, kind, subject);
  }

  /**
   * Whether a stamp is strictly older than the reference its device minted.
   *
   * @param references The store's device references.
   * @param stats Observed metadata.
   * @param separateChangeTime Whether both modification and change ticks must
   *   have ended.
   * @evidence contracts/common.md#principled-implementation A strictly newer same-device reference separates the modification tick and, when requested, the change tick; restoring an old mtime cannot separate a fresh ctime.
   * @evidence contracts/common.md#clear-and-simple-design One lookup supplies the reference for the requested stamp comparisons.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing reference is never replaced by wall time.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the strict ordering.
   * @evidence contracts/portability.md#os-neutral-implementation References are matched by native device identifier.
   * @evidence contracts/performance.md#efficient-algorithms One map lookup and at most two bigint comparisons.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A scalar predicate.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
   */
  export function separable(
    references: ReadonlyMap<bigint, bigint>,
    stats: fs.BigIntStats,
    separateChangeTime = false,
  ): boolean {
    const minted = references.get(stats.dev);
    return (
      minted !== undefined &&
      stats.mtimeNs < minted &&
      (!separateChangeTime || stats.ctimeNs < minted)
    );
  }

  /**
   * A clock reference minted by a write of the cache's own: the modification
   * stamp a fresh probe file got in `directory`, by the device that reported
   * it.
   *
   * A stamp strictly older than the same device's fresh reference satisfies the
   * separation policy. Reuse still assumes the filesystem's reported metadata
   * reflects writes; the comparison cannot certify arbitrary timestamp
   * restoration or future clock behavior. The probe is the cache's own file,
   * named for this call, and removal is attempted at once, so concurrent
   * readers never lend each other a reference. A failed write, or a population
   * on another device, leaves nothing separable, and the proof reads the
   * files.
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
    return mint(directory).references;
  }

  /**
   * {@link mintReference}, and whether the probe's directory moved both of its
   * stamps when the probe was created in it: the premise under which a
   * directory's stamps witness its entries (`IPluginSourceListing`). The
   * directory's stamps are taken only when it existed before this call, so a
   * directory created now, whose stamps are new anyway, proves nothing; a
   * creation within the tick of the directory's last change leaves the device
   * unproven for this store, which only costs enumeration.
   */
  function mint(directory: string): {
    references: Map<bigint, bigint>;
    listings: Set<bigint>;
  } {
    const references = new Map<bigint, bigint>();
    const listings = new Set<bigint>();
    const probe = path.join(
      directory,
      `clock-${process.pid}-${crypto.randomUUID()}.probe`,
    );
    let ownsProbe = false;
    try {
      const parent = fs.lstatSync(directory, {
        bigint: true,
        throwIfNoEntry: false,
      });
      if (parent !== undefined && !parent.isDirectory())
        return { references, listings };
      if (parent === undefined) fs.mkdirSync(directory, { recursive: true });
      const fd = fs.openSync(probe, "wx");
      ownsProbe = true;
      try {
        fs.writeFileSync(fd, `${process.hrtime.bigint()}\n`);
      } finally {
        fs.closeSync(fd);
      }
      const stats = fs.lstatSync(probe, { bigint: true });
      references.set(stats.dev, stats.mtimeNs);
      if (parent !== undefined) {
        const moved = fs.lstatSync(directory, { bigint: true });
        if (
          moved.dev === stats.dev &&
          moved.mtimeNs > parent.mtimeNs &&
          moved.ctimeNs > parent.ctimeNs
        )
          listings.add(stats.dev);
      }
    } catch {
      references.clear();
      listings.clear();
    } finally {
      try {
        if (ownsProbe) fs.rmSync(probe, { force: true });
      } catch {
        // A leftover probe contains this call's hrtime text, not source data.
      }
    }
    return { references, listings };
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

  /** Directory below the system temporary directory that holds its probes. */
  const TEMPORARY_REFERENCE_DIRNAME = "ttsc-clock-references";

  /** Per-store lazy temporary-volume minters, released when the store drops. */
  const temporaryMinters = new WeakMap<Store, () => void>();

  /**
   * Population kinds whose content cannot reach outside the subject via links,
   * so an immutable Nix store path can stand for the population. `goroot` is
   * excluded because `walkGoRootIdentity` follows symlinks.
   */
  const NIX_STORE_CONFINED_KINDS: ReadonlySet<string> = new Set([
    "plugin-source",
    "executable",
  ]);

  /** Direct child of a Nix store root: 32 Nix base32 characters, `-`, name. */
  const NIX_STORE_PATH_NAME = /^[0-9a-df-np-sv-z]{32}-.+$/;

  function resolveNixStore(
    env: NodeJS.ProcessEnv,
  ): { readonly root: string; readonly uid: bigint } | undefined {
    if (typeof process.getuid !== "function") return undefined;
    try {
      const configured = SidecarEnvironment.read(env, "NIX_STORE_DIR");
      const root = fs.realpathSync.native(configured || "/nix/store");
      const stats = fs.lstatSync(root, { bigint: true });
      return stats.isDirectory() ? { root, uid: stats.uid } : undefined;
    } catch {
      return undefined;
    }
  }

  function nixStoreObservation(
    store: Store,
    kind: string,
    subject: string,
  ): (Observation & { readonly listing?: IPluginSourceListing }) | undefined {
    const nixStore = store.nixStore;
    if (nixStore === undefined || !NIX_STORE_CONFINED_KINDS.has(kind))
      return undefined;
    try {
      const realSubject = fs.realpathSync.native(subject);
      const relative = path.relative(nixStore.root, realSubject);
      if (
        relative === "" ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      )
        return undefined;
      const sepIndex = relative.indexOf(path.sep);
      const entryName =
        sepIndex === -1 ? relative : relative.slice(0, sepIndex);
      if (!NIX_STORE_PATH_NAME.test(entryName)) return undefined;
      const storePath = path.join(nixStore.root, entryName);
      const stats = fs.lstatSync(storePath, { bigint: true });
      if (
        !stats.isDirectory() ||
        (stats.mode & 0o222n) !== 0n ||
        stats.uid !== nixStore.uid
      )
        return undefined;
      return {
        separable: true,
        signature: `nix-store:${stats.dev}:${stats.ino}:${stats.ctimeNs}:${JSON.stringify([storePath, realSubject])}`,
      };
    } catch {
      return undefined;
    }
  }

  interface IRecord {
    format: string;
    version: string;
    kind: string;
    subject: string;
    signature: string;
    digest: string;

    /** The population's listing, when its observer kept one. */
    listing?: IPluginSourceListing;
  }

  // The temporary-volume reference lives in one directory reused by every
  // load: creating and removing an entry of the temporary directory itself on
  // each load would move that directory's metadata, which is the signature of
  // every missing path below it a descriptor proof observed (#1721). A shared
  // directory such as POSIX `/tmp` is writable by every user and a fixed name
  // there could be another user's, so the directory is named for this user,
  // created private, and used only while it is a real directory this user owns
  // that nobody else can write to.
  function temporaryReference(
    projectRoot: string,
    owned: ReadonlyMap<bigint, bigint>,
  ): {
    references: ReadonlyMap<bigint, bigint>;
    listings: ReadonlySet<bigint>;
  } {
    const none = { references: new Map(), listings: new Set<bigint>() };
    try {
      const uid =
        typeof process.getuid === "function" ? process.getuid() : undefined;
      const parent = systemTempOutsideProject(projectRoot);
      if (owned.has(fs.statSync(parent, { bigint: true }).dev)) return none;
      const directory = path.join(
        parent,
        uid === undefined
          ? TEMPORARY_REFERENCE_DIRNAME
          : `${TEMPORARY_REFERENCE_DIRNAME}-${uid}`,
      );
      try {
        fs.mkdirSync(directory, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") return none;
      }
      const stats = fs.lstatSync(directory);
      if (
        !stats.isDirectory() ||
        (uid !== undefined && (stats.uid !== uid || (stats.mode & 0o022) !== 0))
      )
        return none;
      return mint(directory);
    } catch {
      return none;
    }
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
      const value = JSON.parse(
        fs.readFileSync(file, "utf8"),
      ) as Partial<IRecord>;
      return value.format === FORMAT &&
        typeof value.version === "string" &&
        typeof value.kind === "string" &&
        typeof value.subject === "string" &&
        typeof value.signature === "string" &&
        typeof value.digest === "string" &&
        (value.listing === undefined || isListing(value.listing))
        ? (value as IRecord)
        : undefined;
    } catch {
      return undefined;
    }
  }

  function isListing(value: unknown): value is IPluginSourceListing {
    const listing = value as Partial<IPluginSourceListing> | null;
    return (
      typeof listing === "object" &&
      listing !== null &&
      Array.isArray(listing.directories) &&
      listing.directories.every(
        (row) =>
          Array.isArray(row) &&
          row.length === 2 &&
          typeof row[0] === "string" &&
          typeof row[1] === "string",
      ) &&
      Array.isArray(listing.files) &&
      listing.files.every((file) => typeof file === "string")
    );
  }
}
