import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ITtscCompilerTransformation } from "../../../structures/ITtscCompilerTransformation";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";

/**
 * Replay the compiler and native input witnesses of a completed runtime build.
 * Read predicates keep their original text or raw-byte codec; absence, entry
 * kind, physical target and directory membership remain independent predicates.
 * Failed or unsupported observations withhold reuse.
 *
 * @evidence contracts/common.md#principled-implementation Predicate replay compares actual current native observations with generation-captured values instead of treating current hashes as proof of what an earlier producer read.
 * @evidence contracts/common.md#clear-and-simple-design One namespace separates result admission, compiler predicates and the native version-one byte codec.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown codecs, failed reads and producer proof failures decline cache admission without fabricating successful observations.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes codec ownership and fail-closed proof behavior.
 * @evidence contracts/portability.md#os-neutral-implementation Native filesystem calls retain physical paths, raw POSIX directory names and link bytes; Windows string names follow the producer's UTF-8 codec.
 * @evidence contracts/performance.md#efficient-algorithms Replay visits only recorded predicates and their bytes or immediate directory entries; it does not scan unrelated trees.
 * @evidence contracts/performance.md#reuse-equivalent-work Proof authorizes a completed result only while every retained predicate still holds; this namespace retains no historical truth cache.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Read buffers and directory records are call-local; synchronous operations retain no handle, watcher or native process.
 */
export namespace RuntimeInputProof {
  /**
   * Validate result-level host witnesses and every reported compiler predicate.
   * The caller independently proves the selected compiler, project membership
   * and plugin selection; an absent graph alone grants no completeness.
   *
   * @evidence contracts/common.md#principled-implementation Explicit incomplete observations and any graph failure reject reuse; host paths require both content and physical witnesses, and rich compiler predicates are replayed under their own codec.
   * @evidence contracts/common.md#clear-and-simple-design One admission pass delegates individual compiler observations and native codecs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing witness fields never become an empty successful observation, and only the caller-owned private output subtree is excluded.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies result admission and the caller's separate completeness obligations.
   * @evidence contracts/portability.md#os-neutral-implementation Native path resolution anchors producer-relative graph keys, and current physical paths come from native realpath.
   * @evidence contracts/performance.md#efficient-algorithms Input and predicate populations drive replay; each read hashes its actual bytes and directories sort immediate entry records.
   * @evidence contracts/performance.md#reuse-equivalent-work Generation witnesses, rather than an identity-key match, decide whether a completed build remains reusable.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Temporary path and predicate records are invocation-owned without retained handles or history.
   */
  export function holds(
    result: TtscBuildResult,
    projectRoot: string,
    emitDir: string,
  ): boolean {
    if (
      result.observationsComplete === false ||
      Object.keys(result.graph?.inputProofFailures ?? {}).length !== 0
    )
      return false;
    try {
      for (const file of result.hostInputs ?? []) {
        const [currentPhysical, hash] = observeHostInput(file);
        if (
          !Object.hasOwn(result.hostInputHashes ?? {}, file) ||
          !Object.hasOwn(result.hostInputRealpaths ?? {}, file) ||
          currentPhysical !== result.hostInputRealpaths![file] ||
          hash !== result.hostInputHashes![file]
        )
          return false;
      }
      const graph = result.graph;
      for (const [name, observed] of Object.entries(
        graph?.inputObservations ?? {},
      )) {
        const file = path.resolve(projectRoot, name);
        const relative = path.relative(emitDir, file);
        if (
          relative === "" ||
          (!path.isAbsolute(relative) &&
            relative !== ".." &&
            !relative.startsWith(".." + path.sep))
        )
          continue;
        if (!observationHolds(file, observed)) return false;
      }
      for (const [name, expected] of Object.entries(graph?.inputHashes ?? {})) {
        if (Object.hasOwn(graph?.inputObservations ?? {}, name)) continue;
        const file = path.resolve(projectRoot, name);
        if (physical(file) !== graph?.inputRealpaths?.[name]) return false;
        let current: string | null = null;
        try {
          if (fs.statSync(file).isFile())
            current = textHash(fs.readFileSync(file));
        } catch (error) {
          if (!missing(error)) return false;
        }
        if (current !== expected) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Observe a declared host input under its existing raw-file or directory-kind
   * codec. Descriptor resolution can declare directories as presence inputs;
   * those are distinct from compiler source reads and directory enumeration.
   * Native identity and metadata bracket the observation. Missing paths carry
   * null witnesses, while unavailable or changing observations throw.
   *
   * @evidence contracts/common.md#principled-implementation Raw file bytes and the existing ttsc:host-input:directory domain marker reproduce the descriptor/native host-input contract, with physical identity and full native metadata checked before and after.
   * @evidence contracts/common.md#clear-and-simple-design One observer supplies the same declared-host codec to input capture and retained-result admission, independently of compiler text and enumeration predicates.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only ENOENT/ENOTDIR establish absence; unsupported entry kinds, read failures and changing witnesses refuse reuse instead of becoming empty content.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes directory presence from directory membership, states the producer codec and explains failure semantics.
   * @evidence contracts/portability.md#os-neutral-implementation Native following stat, realpath and byte reads retain actual host links and physical spellings without OS-name or separator guesses.
   * @evidence contracts/performance.md#efficient-algorithms File observations hash their complete byte buffer and bracket native metadata; directory presence hashes a fixed marker without scanning members.
   * @evidence contracts/performance.md#reuse-equivalent-work Capture and admission share the producer's codec, but every invocation observes current witnesses and retains no path-only truth.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Read buffers and stat records are call-local; synchronous filesystem calls leave no retained handle or watcher.
   */
  export function observeHostInput(
    file: string,
  ): readonly [string | null, string | null] {
    const beforePhysical = physical(file);
    let before: fs.BigIntStats;
    try {
      before = fs.statSync(file, { bigint: true });
    } catch (error) {
      if (!missing(error)) throw error;
      if (beforePhysical !== null || physical(file) !== null)
        throw new Error("Host input changed during absence observation.");
      return [null, null];
    }
    if (!before.isFile() && !before.isDirectory())
      throw new Error("Unsupported runtime host input kind.");
    const hash = before.isDirectory()
      ? digest("ttsc:host-input:directory\0")
      : digest(fs.readFileSync(file));
    const after = fs.statSync(file, { bigint: true });
    const signature = (stat: fs.BigIntStats): string =>
      [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
    if (
      signature(before) !== signature(after) ||
      beforePhysical !== physical(file)
    )
      throw new Error("Host input changed during observation.");
    return [beforePhysical, hash];
  }

  /**
   * Compare one compiler query record with the corresponding current queries.
   *
   * @evidence contracts/common.md#principled-implementation Existence, stat, read, directory enumeration and physical identity are compared independently, matching the compiler's query grammar.
   * @evidence contracts/common.md#clear-and-simple-design A fixed predicate projection delegates native byte encodings and text hashing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed compiler reads remain failures; enumeration follows symlink targets for the compiler view without treating them as native entry predicates.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the compiler-query comparison boundary.
   * @evidence contracts/portability.md#os-neutral-implementation Native following stat and realpath provide actual kinds and targets; directory names use UTF-8 byte ordering, independently of OS case assumptions.
   * @evidence contracts/performance.md#efficient-algorithms Fixed predicate checks add native queries, content hashing and immediate-entry sorting according to the fields actually recorded.
   * @evidence contracts/performance.md#reuse-equivalent-work Each supplied producer record is revalidated; no watcher silence or path memo supplies authority.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Temporary buffers, entries and sorted name arrays are call-local.
   */
  function observationHolds(
    file: string,
    observed: ITtscCompilerTransformation.IInputObservation,
  ): boolean {
    for (const predicate of observed.nativePredicates ?? [])
      if (
        predicate.version !== 1 ||
        !predicate.identityStable ||
        physical(file) !== predicate.realpath ||
        nativeDigest(file, predicate.kind) !== predicate.digest
      )
        return false;
    let kind: "file" | "directory" | "missing" = "missing";
    try {
      const stat = fs.statSync(file);
      kind = stat.isDirectory() ? "directory" : "file";
    } catch (error) {
      if (!missing(error)) return false;
    }
    if (
      observed.fileExists !== undefined &&
      observed.fileExists !== (kind === "file")
    )
      return false;
    if (
      observed.directoryExists !== undefined &&
      observed.directoryExists !== (kind === "directory")
    )
      return false;
    if (observed.stat !== undefined && observed.stat !== kind) return false;
    if (observed.readFile !== undefined) {
      let hash: string | null = null;
      try {
        if (kind !== "directory") hash = textHash(fs.readFileSync(file));
      } catch {
        /* Compiler read failed. */
      }
      if (
        observed.readFile.ok ? hash !== observed.readFile.hash : hash !== null
      )
        return false;
    }
    if (observed.realpath !== undefined) {
      const current = physical(file);
      if (
        observed.realpath.ok
          ? current !== observed.realpath.path
          : current !== null
      )
        return false;
    }
    if (observed.accessibleEntries !== undefined) {
      const directories: string[] = [];
      const files: string[] = [];
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(file, { withFileTypes: true });
      } catch {
        /* Compiler enumeration returns an empty view. */
      }
      for (const entry of entries) {
        try {
          const stat = entry.isSymbolicLink()
            ? fs.statSync(path.join(file, entry.name))
            : entry;
          if (stat.isDirectory()) directories.push(entry.name);
          else if (stat.isFile()) files.push(entry.name);
        } catch {
          /* Compiler enumeration omits inaccessible link targets. */
        }
      }
      const compare = (a: string, b: string): number =>
        Buffer.compare(Buffer.from(a), Buffer.from(b));
      if (
        JSON.stringify({
          directories: directories.sort(compare),
          files: files.sort(compare),
        }) !== JSON.stringify(observed.accessibleEntries)
      )
        return false;
    }
    return true;
  }

  /**
   * Reproduce native version-one file, optional-file, entry and directory
   * bytes.
   *
   * @evidence contracts/common.md#principled-implementation Explicit kind tags, raw file/link bytes and sorted nul-delimited member records match the producer's version-one native predicate codec.
   * @evidence contracts/common.md#clear-and-simple-design One kind dispatcher owns native encoding independently of decoded compiler text.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing entries require native absence errors and unsupported query failures propagate to refuse admission.
   * @evidence contracts/common.md#meaningful-documentation The headline states version, supported kinds and byte-level replay.
   * @evidence contracts/portability.md#os-neutral-implementation POSIX names/link targets stay Buffer values and Windows names/link text use the native UTF-8 producer codec; lstat preserves link entry kinds.
   * @evidence contracts/performance.md#efficient-algorithms File kinds hash content bytes; directory kinds enumerate and sort immediate member records in O(N log N) comparisons plus encoded bytes and native link queries.
   * @evidence contracts/performance.md#reuse-equivalent-work Each digest describes a current observation, with producer comparison owned by admission.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Buffers and sorted member records end with the call; synchronous queries retain no open handle.
   */
  function nativeDigest(file: string, kind: string): string {
    if (kind === "file") return digest(fs.readFileSync(file));
    if (kind === "optional-file") {
      try {
        return fs.statSync(file).isFile()
          ? digest(
              Buffer.concat([Buffer.from("file\0"), fs.readFileSync(file)]),
            )
          : digest("missing\0");
      } catch (error) {
        if (missing(error)) return digest("missing\0");
        throw error;
      }
    }
    if (kind === "entry") {
      try {
        const entry = fs.lstatSync(file);
        return entry.isSymbolicLink()
          ? digest(
              Buffer.concat([
                Buffer.from("symlink\0"),
                fs.readlinkSync(file, { encoding: "buffer" }),
              ]),
            )
          : digest(
              (entry.isDirectory()
                ? "directory"
                : entry.isFile()
                  ? "file"
                  : "other") + "\0",
            );
      } catch (error) {
        if (missing(error)) return digest("missing\0");
        throw error;
      }
    }
    if (kind !== "directory") throw new Error("unsupported native input codec");
    const records: Buffer[] = [];
    const names =
      process.platform === "win32"
        ? fs.readdirSync(file).map((name) => Buffer.from(name))
        : fs.readdirSync(file, { encoding: "buffer" });
    for (const name of names) {
      const target =
        process.platform === "win32"
          ? path.join(file, name.toString())
          : Buffer.concat([Buffer.from(file + path.sep), name]);
      const entry = fs.lstatSync(target);
      const entryKind = entry.isDirectory()
        ? "directory"
        : entry.isFile()
          ? "file"
          : entry.isSymbolicLink()
            ? "symlink"
            : "other";
      const link = entry.isSymbolicLink()
        ? fs.readlinkSync(target, { encoding: "buffer" })
        : Buffer.alloc(0);
      records.push(
        Buffer.concat([name, Buffer.from("\0" + entryKind + "\0"), link]),
      );
    }
    records.sort(Buffer.compare);
    return digest(
      Buffer.concat(
        records.flatMap((record, index) =>
          index === 0 ? [record] : [Buffer.from([0]), record],
        ),
      ),
    );
  }

  /**
   * Hash compiler-decoded text, retaining the BOM and UTF-16 producer policy.
   *
   * @evidence contracts/common.md#principled-implementation UTF-8 BOM removal and even UTF-16 BOM decoding precede SHA-256, matching compiler text rather than raw native bytes.
   * @evidence contracts/common.md#clear-and-simple-design One pure codec distinguishes compiler reads from native raw-byte predicates.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Encoding discriminants come from supplied bytes; big-endian conversion copies before swapping.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the codec boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation BOM decoding has no native filesystem boundary.
   * @evidence contracts/performance.md#efficient-algorithms Decoding/hashing scan input bytes, with proportional UTF-16 text and big-endian copy allocation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The pure codec stores no historical result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the digest escapes.
   */
  function textHash(bytes: Buffer): string {
    if (
      bytes.length >= 2 &&
      ((bytes[0] === 0xff && bytes[1] === 0xfe) ||
        (bytes[0] === 0xfe && bytes[1] === 0xff))
    ) {
      const text = Buffer.from(
        bytes.subarray(2, 2 + Math.floor((bytes.length - 2) / 2) * 2),
      );
      if (bytes[0] === 0xfe) text.swap16();
      return digest(Buffer.from(text.toString("utf16le"), "utf8"));
    }
    return digest(
      bytes.length >= 3 &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf
        ? bytes.subarray(3)
        : bytes,
    );
  }

  /**
   * Obtain a current physical coordinate, with null only for native absence.
   *
   * @evidence contracts/common.md#principled-implementation Native realpath distinguishes missing paths from unavailable observations.
   * @evidence contracts/common.md#clear-and-simple-design One physical observer serves every predicate family.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Permission and IO errors never become proved absence.
   * @evidence contracts/common.md#meaningful-documentation The headline specifies null semantics.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath resolves actual host links and spelling without OS-derived case folding.
   * @evidence contracts/performance.md#efficient-algorithms Resolution costs follow native path and link traversal.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every query is current.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handle is retained.
   */
  function physical(file: string): string | null {
    try {
      return fs.realpathSync.native(file);
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  /**
   * Classify only native absent-path errors.
   *
   * @evidence contracts/common.md#principled-implementation ENOENT and ENOTDIR express absent native paths; other failures remain unavailable.
   * @evidence contracts/common.md#clear-and-simple-design One error predicate centralizes absence semantics.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A caught error does not imply absence.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies its narrow domain.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Error-code classification performs no native query.
   * @evidence contracts/performance.md#efficient-algorithms A fixed pair of code comparisons uses bounded work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work No result cache is owned.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No resource is acquired.
   */
  function missing(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    );
  }

  /**
   * SHA-256 of supplied text or raw bytes.
   *
   * @evidence contracts/common.md#principled-implementation Standard SHA-256 consumes the actual supplied byte sequence.
   * @evidence contracts/common.md#clear-and-simple-design One digest codec serves the distinct input encodings.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No expected hash substitutes for current bytes.
   * @evidence contracts/common.md#meaningful-documentation The headline states the codec.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Hashing performs no native query.
   * @evidence contracts/performance.md#efficient-algorithms Hashing scans the supplied bytes once.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work No history is retained.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the digest escapes.
   */
  function digest(bytes: string | Buffer): string {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}
