import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2ETrace } from "../../../internal/E2ETrace";
import { PluginContentIdentities } from "../../../plugin/internal/source/PluginContentIdentities";
import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { recordCacheFileUse } from "../../../plugin/internal/source/recordCacheFileUse";

/**
 * Witness the content of a compiler-selected input population, reusing each
 * file's recorded hash while that file's own native metadata still proves it.
 * Selection remains compiler-owned and is repeated by the caller; this record
 * never decides source membership or resolution.
 *
 * WARNING (samchon/ttsc#1852): the proof is kept per file, never per
 * population. One aggregate record over the whole selected vector was discarded
 * by any single change in it, so editing one source, adding one file, or a tool
 * moving one manifest's change stamp made every capture read and hash every
 * selected file again, in every project that reached it. A capture also asked
 * the filesystem for each file's physical path twice. Both made a full cache
 * hit cost more than the compile it replaced.
 *
 * @evidence contracts/common.md#principled-implementation A row pairs one file's content hash with its physical path and its device, inode, mode, size, modification and change stamps, written only around an actual byte read whose metadata held still. It stands only while all of them still match and both stamps precede the store's same-device reference; current absence is observed separately.
 * @evidence contracts/common.md#clear-and-simple-design One record per subject holds every row, so a population costs one record read, and each file is judged alone, so a change costs that file's bytes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable, unseparable or moved observations read real content, a file that moves during its read fails the capture, and compiler selection is never inferred from recorded paths.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes content reuse from source selection, states the regression this shape prevents and the metadata authority and fallback.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat, realpath and bigint metadata retain physical targets and device-specific stamp authority, without platform case guesses.
 * @evidence contracts/performance.md#efficient-algorithms A capture reads one record and performs one native metadata request per selected path plus one physical resolution per distinct directory; it reads the bytes only of files whose row no longer holds.
 * @evidence contracts/performance.md#reuse-equivalent-work Captures in any process share a file's hash while that file's separable metadata and physical path equal the row's; an edit, replacement, retarget or fresh stamp withdraws that row alone.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The collected identity store owns one record per subject, rewritten to the rows of the latest population only when a row changed; a session's maps live until it closes, and no handle is retained.
 */
export namespace RuntimeInputContents {
  /**
   * One selected path with its physical path and its hash under the session's
   * codec, or two nulls for a path that names nothing.
   *
   * @evidence contracts/common.md#principled-implementation Path, physical target and content are the three facts a consumer compares; absence is the explicit null pair rather than an omitted row.
   * @evidence contracts/common.md#clear-and-simple-design A positional triple serializes compactly into snapshots that hold one row per input.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A null hash never stands for unread content; it accompanies a null physical path only.
   * @evidence contracts/common.md#meaningful-documentation The prose names each position and the absent form.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The type carries native path strings without interpreting them.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type runs no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type grants no reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type holds no resource.
   */
  export type Row = [
    file: string,
    physical: string | null,
    hash: string | null,
  ];

  /**
   * One capture's observations: each path is witnessed once, in any number of
   * batches, and the record is published when the session closes.
   *
   * @evidence contracts/common.md#principled-implementation Later batches may depend on earlier answers, such as the manifests above a file's physical directory, while every path is still observed exactly once under one record reading.
   * @evidence contracts/common.md#clear-and-simple-design Two operations: witness paths, then publish what was learned.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Closing without a store or without a changed row writes nothing; no witness is fabricated for an unobserved path.
   * @evidence contracts/common.md#meaningful-documentation Members state batch order, repeat behavior and publication.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The interface performs no native operation; open implements them.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The interface runs no algorithm; open states the work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The interface grants no reuse; open states it.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The opener owns the session for one capture and releases its maps by dropping it after close.
   */
  export interface Session {
    /**
     * Witness `inputs` and return their rows in the given order. A path already
     * witnessed in this session returns its first row without another read.
     *
     * @evidence contracts/common.md#principled-implementation One capture states one answer per path, so a path asked for twice gets the witness already taken instead of a second observation that could disagree.
     * @evidence contracts/common.md#clear-and-simple-design Batches let a caller derive later paths from earlier rows while the session keeps the single-witness rule.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed witness throws; no row is returned for a path that could not be observed.
     * @evidence contracts/common.md#meaningful-documentation The prose states order and repeat behavior.
     * @evidence contracts/portability.md#os-neutral-implementation Paths are native absolute spellings witnessed by the session's native metadata and resolution.
     * @evidence contracts/performance.md#efficient-algorithms One map lookup per path, and one witness for each path not yet seen.
     * @evidence contracts/performance.md#reuse-equivalent-work A repeated path reuses this session's row; cross-capture reuse is the record's.
     * @evidence contracts/performance.md#bound-retention-and-release-resources Rows are retained for the session and returned by reference; no handle is held.
     */
    observe(inputs: readonly string[]): Row[];

    /**
     * Publish the record when a row changed, and report the capture's content
     * reads. Call once, after the last batch.
     *
     * @evidence contracts/common.md#principled-implementation Only rows whose read was bracketed by equal separable metadata are published, and only when the population's rows differ from the record read at opening.
     * @evidence contracts/common.md#clear-and-simple-design Publication is one explicit step after every batch, so a record always describes a whole population.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts A publication failure is ignored because the witnesses already returned stand without it.
     * @evidence contracts/common.md#meaningful-documentation The prose states the publication condition, the report and the single call.
     * @evidence contracts/portability.md#os-neutral-implementation The record is replaced atomically in its own directory by the cache layout owner.
     * @evidence contracts/performance.md#efficient-algorithms An unchanged population writes nothing beyond a use stamp; a changed one serializes its rows once.
     * @evidence contracts/performance.md#reuse-equivalent-work The published rows are what later captures in any process reuse.
     * @evidence contracts/performance.md#bound-retention-and-release-resources The record keeps only this population's rows, so it does not grow with paths no longer selected.
     */
    close(): void;
  }

  /**
   * Begin one capture for `subject`, the selected project's config path, which
   * only names the record. Without a store every path is read.
   *
   * A path is witnessed from one `lstat`. An entry that is not a link takes its
   * physical path from its directory's, resolved once per directory for the
   * session; a link is resolved itself and judged by its target's metadata.
   * Only `ENOENT` and `ENOTDIR` witness absence; any other failure, an entry
   * that is neither a regular file nor a link to one, and a file whose metadata
   * or physical path moved around its read fail the capture, so the caller
   * builds instead of trusting a torn observation.
   *
   * @param subject Absolute config path naming the record.
   * @param store The run's opened identity store, if any.
   * @param codec How a file's bytes become its hash, with a name that keeps its
   *   record apart: raw bytes by default, or a consumer's own decoding, such as
   *   the text a compiler read.
   * @evidence contracts/common.md#principled-implementation A non-link entry's physical path is its directory's physical path plus its own name, so one resolution per directory states what a resolution per file stated; link entries keep their own resolution. A read is bracketed by equal metadata and physical observations, and a row is recorded only when both were separable.
   * @evidence contracts/common.md#clear-and-simple-design Record reading, per-path witnessing and publication are the session's three steps; the identity store keeps location, version and collection.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing, foreign or malformed records and rows mean a real read, never an empty or guessed hash; a non-missing native error never becomes absence.
   * @evidence contracts/common.md#meaningful-documentation The prose states the witness method per entry kind, the absence rule and each failure effect.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat identifies links, including Windows junctions; realpath.native resolves directories and links, and device references stay per native device.
   * @evidence contracts/performance.md#efficient-algorithms N selected paths cost N metadata requests and D directory resolutions for D distinct directories, one record parse, and B bytes only for the files whose row does not hold. The record is serialized once, only when a row changed.
   * @evidence contracts/performance.md#reuse-equivalent-work A row is reused across captures and processes under equal physical path and separable signature; rows are independent, so one file's change leaves every other row valid.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Directory and row maps are session-local; the published record keeps only this population's rows, and synchronous reads retain no handle.
   */
  export function open(
    subject: string,
    store: PluginContentIdentities.Store | undefined,
    codec: Codec = RAW,
  ): Session {
    const location =
      store === undefined
        ? undefined
        : PluginContentIdentities.recordLocation(
            store,
            `${KIND}:${codec.name}`,
            subject,
          );
    const known =
      store === undefined || location === undefined
        ? new Map<string, StoredRow>()
        : readRecord(location, store.version, subject);
    const directories = new Map<string, string>();
    const observed = new Map<string, Row>();
    const current = new Map<string, StoredRow>();
    let contentReads = 0;
    let changed = false;
    let reused = false;

    const directory = (location: string): string => {
      let physical = directories.get(location);
      if (physical === undefined) {
        physical = fs.realpathSync.native(location);
        directories.set(location, physical);
      }
      return physical;
    };
    /** One metadata reading of `file`: its physical path and target metadata. */
    const stat = (
      file: string,
    ): { physical: string; stats: fs.BigIntStats } | null => {
      try {
        const entry = fs.lstatSync(file, { bigint: true });
        if (entry.isSymbolicLink())
          return {
            physical: fs.realpathSync.native(file),
            stats: fs.statSync(file, { bigint: true }),
          };
        return {
          physical: path.join(
            directory(path.dirname(file)),
            path.basename(file),
          ),
          stats: entry,
        };
      } catch (error) {
        if (!missing(error)) throw error;
        return null;
      }
    };
    const witness = (file: string): Row => {
      const before = stat(file);
      if (before === null) return [file, null, null];
      const state = signature(before.stats, store);
      const row = known.get(file);
      if (
        state.separable &&
        row !== undefined &&
        row[0] === before.physical &&
        row[1] === state.signature
      ) {
        reused = true;
        current.set(file, row);
        return [file, before.physical, row[2]];
      }
      const hash = codec.digest(fs.readFileSync(file));
      contentReads++;
      const after = stat(file);
      const settled =
        after === null ? undefined : signature(after.stats, store);
      if (
        after === null ||
        settled === undefined ||
        after.physical !== before.physical ||
        settled.signature !== state.signature
      )
        throw new Error("Compiler input changed during observation.");
      if (state.separable && settled.separable) {
        current.set(file, [before.physical, state.signature, hash]);
        changed = true;
      }
      return [file, before.physical, hash];
    };

    return {
      observe: (inputs) =>
        inputs.map((file) => {
          let row = observed.get(file);
          if (row === undefined) {
            row = witness(file);
            observed.set(file, row);
          }
          return row;
        }),
      close: () => {
        if (location !== undefined && store !== undefined) {
          // A recorded path this population no longer selects, or no longer
          // proves, leaves the record with the rows that changed.
          if (changed || current.size !== known.size)
            try {
              fs.mkdirSync(path.dirname(location), { recursive: true });
              SourceBuildCacheLayout.replaceCacheMetadataFile(
                location,
                JSON.stringify({
                  format: FORMAT,
                  version: store.version,
                  subject,
                  rows: Object.fromEntries(current),
                } satisfies IRecord),
              );
            } catch {
              // A record is an optimization; the witnesses just read stand.
            }
          else if (reused) recordCacheFileUse(location);
        }
        E2ETrace.capabilityResolution("runtime-input-content", {
          project: subject,
          inputs: observed.size,
          contentReads,
        });
      },
    };
  }

  /**
   * Witness one complete population in a single batch and publish its record.
   *
   * @param inputs Selected paths, in the order the rows are returned.
   * @param subject Absolute config path naming the record.
   * @param store The run's opened identity store, if any.
   * @evidence contracts/common.md#principled-implementation One session witnesses the whole vector and closes, so the rows and the published record describe the same observations.
   * @evidence contracts/common.md#clear-and-simple-design A caller with one batch needs no session handling.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed witness propagates and publishes nothing.
   * @evidence contracts/common.md#meaningful-documentation The prose states the single-batch scope and publication.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Native observation belongs to open.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The work is open's.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Reuse is decided per row by open.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The session is dropped on return.
   */
  export function capture(
    inputs: readonly string[],
    subject: string,
    store: PluginContentIdentities.Store | undefined,
  ): Row[] {
    const session = open(subject, store);
    const rows = session.observe(inputs);
    session.close();
    return rows;
  }

  /**
   * A named rule turning a file's bytes into the hash its rows carry. Records
   * of different codecs never mix.
   *
   * @evidence contracts/common.md#principled-implementation The name enters the record's identity, so a hash is only ever compared with one produced by the same rule.
   * @evidence contracts/common.md#clear-and-simple-design One pair states the rule and its identity; the session needs nothing else from a consumer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The digest receives the exact bytes read inside the metadata bracket.
   * @evidence contracts/common.md#meaningful-documentation Members state identity and input.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The type performs no native operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The type runs no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type grants no reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The type holds no resource.
   */
  export interface Codec {
    /** Stable identity of the rule; part of the record's name. */
    name: string;

    /**
     * Lowercase hexadecimal hash of the file's exact bytes under the rule.
     *
     * @evidence contracts/common.md#principled-implementation The session passes exactly the bytes it read inside the metadata bracket, so the hash describes the proven state.
     * @evidence contracts/common.md#clear-and-simple-design One pure function is all a consumer supplies.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The rule must depend on the bytes alone; nothing else is offered to it.
     * @evidence contracts/common.md#meaningful-documentation The prose states input and output form.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation A member signature performs no native operation.
     * @evidenceExclude contracts/performance.md#efficient-algorithms A member signature runs no algorithm; implementers state theirs.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work A member signature grants no reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A member signature holds no resource.
     */
    digest(bytes: Buffer): string;
  }

  /** SHA-256 of the exact bytes. */
  const RAW: Codec = {
    name: "raw",
    digest: (bytes) => crypto.createHash("sha256").update(bytes).digest("hex"),
  };

  /** Record family in the identity store; one record per subject. */
  const KIND = "runtime-input-content-v3";

  /** Record shape tag; move it when a row's meaning changes. */
  const FORMAT = "ttsc-runtime-input-content-v3";

  /** A file's physical path, metadata signature and raw SHA-256. */
  type StoredRow = [physical: string, signature: string, hash: string];

  interface IRecord {
    format: string;
    version: string;
    subject: string;
    rows: Record<string, StoredRow>;
  }

  /** The metadata signature of a regular file, and whether it is separable. */
  function signature(
    stats: fs.BigIntStats,
    store: PluginContentIdentities.Store | undefined,
  ): PluginContentIdentities.Observation {
    const observation = PluginContentIdentities.statObservation(
      store?.references ?? NO_REFERENCES,
      stats,
      true,
    );
    if (observation === undefined)
      throw new Error("Observed compiler input is not a regular file.");
    return observation;
  }

  const NO_REFERENCES: ReadonlyMap<bigint, bigint> = new Map();

  /** Rows of this subject's record; none when it is absent, foreign or torn. */
  function readRecord(
    location: string,
    version: string,
    subject: string,
  ): Map<string, StoredRow> {
    const rows = new Map<string, StoredRow>();
    try {
      const value = JSON.parse(
        fs.readFileSync(location, "utf8"),
      ) as Partial<IRecord>;
      if (
        value.format !== FORMAT ||
        value.version !== version ||
        value.subject !== subject ||
        typeof value.rows !== "object" ||
        value.rows === null
      )
        return rows;
      for (const [file, row] of Object.entries(value.rows))
        if (
          Array.isArray(row) &&
          row.length === 3 &&
          typeof row[0] === "string" &&
          typeof row[1] === "string" &&
          typeof row[2] === "string" &&
          /^[a-f0-9]{64}$/.test(row[2])
        )
          rows.set(file, row as StoredRow);
    } catch {
      rows.clear();
    }
    return rows;
  }

  /** Only native absent-path errors authorize a missing input witness. */
  function missing(error: unknown): boolean {
    return (
      (error as NodeJS.ErrnoException)?.code === "ENOENT" ||
      (error as NodeJS.ErrnoException)?.code === "ENOTDIR"
    );
  }
}
