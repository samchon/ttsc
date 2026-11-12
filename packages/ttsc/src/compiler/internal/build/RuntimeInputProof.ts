import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ITtscCompilerTransformation } from "../../../structures/ITtscCompilerTransformation";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { SidecarEnvironment } from "../sharedHost/SidecarEnvironment";
import type { RuntimeInputContents } from "./RuntimeInputContents";

/**
 * Replay the compiler and native input witnesses of a completed runtime build.
 * Read predicates keep their original text or raw-byte codec; absence, entry
 * kind, physical target and directory membership remain independent predicates.
 * Failed or unsupported observations withhold reuse.
 *
 * @evidence contracts/common.md#principled-implementation Replay compares generation witnesses with current existence, stat, decoded text, physical identity and directory membership. Native version-one file, optional-file, entry and directory codecs use explicit tags, raw file/link bytes and sorted nul-delimited records. Compiler text strips UTF-8 BOM or decodes even UTF-16LE/BE bytes before SHA-256; host directory presence uses its separate domain marker.
 * @evidence contracts/common.md#clear-and-simple-design One namespace separates result admission, declared host inputs, compiler predicates and the native version-one codec. Private physical/absence and SHA-256 helpers serve the codecs without merging their meanings.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown codecs, failed reads and producer proof failures decline admission. Only ENOENT/ENOTDIR prove absence; other physical-resolution errors remain unavailable. Following stat classifies compiler views while lstat retains native link kinds; only the producer private output subtree is excluded.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies generation proof, codec ownership and refusal semantics; private helper comments identify query, byte, decoded-text and null/error boundaries.
 * @evidence contracts/portability.md#os-neutral-implementation Native stat, lstat and realpath retain actual kinds, targets and spellings without case assumptions. POSIX directory names/link targets stay raw bytes, Windows names follow the producer UTF-8 codec, and compiler directory entries sort by UTF-8 bytes.
 * @evidence contracts/performance.md#efficient-algorithms Replay visits recorded predicates and their bytes or immediate directory entries rather than unrelated trees. Hashing and BOM decoding cost O(bytes), including a big-endian copy; directory codecs cost O(N log N) sorting plus encoded bytes and link queries. Physical resolution follows native path/link traversal.
 * @evidence contracts/performance.md#reuse-equivalent-work Every retained predicate is observed anew to authorize completed-result reuse. Host capture and admission share the producer codec; no path memo, watcher silence or historical hash independently grants authority.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Read buffers, decoded text, paths and sorted directory members are call-local and have no proof-reader byte or entry cap. Synchronous calls retain no handle, watcher, process or historical population; only returned proof values escape.
 */
export namespace RuntimeInputProof {
  /**
   * Validate result-level host witnesses and every reported compiler predicate.
   * The caller independently proves the selected compiler, project membership
   * and plugin selection; an absent graph alone grants no completeness. Every
   * recorded environment read must still have its value, or remain unset, in
   * `environment`, the environment the build would spawn its plugins under.
   *
   * `observed` carries the declared host inputs the caller's proof observed
   * just before this admission ({@link observeHostInput}); an input it holds is
   * compared with that observation rather than observed again, and any other is
   * observed here.
   *
   * With `compilerReplayed`, the caller replays the result's complete compiler
   * observations itself ({@link replay}). The graph's compiler predicates and
   * its content projection are taken from that same population, so they are not
   * replayed a second time, which would read every source again; native
   * contributor predicates and host witnesses are still validated here.
   *
   * @evidence contracts/common.md#principled-implementation Explicit incomplete observations and any graph failure reject reuse; host paths require both content and physical witnesses, recorded environment reads require their exact value or absence, and rich compiler predicates are replayed under their own codec.
   * @evidence contracts/common.md#clear-and-simple-design One admission pass delegates individual compiler observations and native codecs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing witness fields never become an empty successful observation, a changed environment value is a changed input, and only the caller-owned private output subtree is excluded.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies result admission and the caller's separate completeness obligations.
   * @evidence contracts/portability.md#os-neutral-implementation Native path resolution anchors producer-relative graph keys, current physical paths come from native realpath, and SidecarEnvironment.read applies Windows' case-insensitive variable names.
   * @evidence contracts/performance.md#efficient-algorithms Input and predicate populations drive replay; each read hashes its actual bytes and directories sort immediate entry records.
   * @evidence contracts/performance.md#reuse-equivalent-work Generation witnesses, rather than an identity-key match, decide whether a completed build remains reusable; a host input the caller's proof observed just before is compared with that one observation instead of a second one.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Temporary path and predicate records are invocation-owned without retained handles or history.
   */
  export function holds(
    result: TtscBuildResult,
    projectRoot: string,
    emitDir: string,
    environment: NodeJS.ProcessEnv,
    compilerReplayed = false,
    observed?: ReadonlyMap<string, readonly [string | null, string | null]>,
  ): boolean {
    if (
      result.observationsComplete === false ||
      Object.keys(result.graph?.inputProofFailures ?? {}).length !== 0
    )
      return false;
    for (const [name, recorded] of Object.entries(
      result.environmentInputs ?? {},
    ))
      if ((SidecarEnvironment.read(environment, name) ?? null) !== recorded)
        return false;
    try {
      for (const file of result.hostInputs ?? []) {
        const [currentPhysical, hash] =
          observed?.get(file) ?? observeHostInput(file);
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
        // The graph's compiler predicates are a projection of the population
        // the caller replays whole, so only a native contributor's own
        // predicates, which that population never carries, are replayed here.
        if (compilerReplayed && observed.nativePredicates === undefined)
          continue;
        if (
          !observationHolds(
            file,
            compilerReplayed
              ? { nativePredicates: observed.nativePredicates }
              : observed,
          )
        )
          return false;
      }
      for (const [name, expected] of Object.entries(
        compilerReplayed ? {} : (graph?.inputHashes ?? {}),
      )) {
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
   * Replay a compiler's complete filesystem observations against the disk and
   * name the first path whose answer moved, or `undefined` when every predicate
   * still holds.
   *
   * The population is every question the compiler asked while it built one
   * result (`TtscBuildResult.compilerObservations`). When each still has its
   * recorded answer, compiling again would load the same configuration, root
   * files, resolved modules and source text, so the stored result stands
   * without running the compiler (samchon/ttsc#1852). An added root appears as
   * a changed directory listing, a new higher-priority resolution candidate as
   * a file that now exists, an edit as a changed text hash.
   *
   * A read file's text hash comes from `contents`, which proves an unchanged
   * file from its metadata and reads only one that moved. Paths inside
   * `excluded`, the producer's own private output root, are not inputs.
   *
   * @param observations The stored result's complete observation population.
   * @param excluded The private output root of the build that produced it.
   * @param contents An open content session using {@link textCodec}.
   * @evidence contracts/common.md#principled-implementation Equal answers to every recorded compiler question reproduce the compiler's inputs; each predicate kind is compared under the codec it was recorded in, and any unobservable state is a moved answer.
   * @evidence contracts/common.md#clear-and-simple-design One pass visits the population; the content session owns byte reuse and this function owns predicate comparison.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No predicate is skipped for a recognized path or kind; only the producer's private output subtree is excluded, and native-codec predicates, which a compiler population never carries, refuse the replay.
   * @evidence contracts/common.md#meaningful-documentation Native prose states why the population is sufficient, how each kind of change surfaces, and the exclusion.
   * @evidence contracts/portability.md#os-neutral-implementation Following stat classifies as the compiler's view does; physical paths come from the session's native resolution, with a per-path native resolution before any difference is declared, so a case or short-name spelling is not mistaken for a retarget.
   * @evidence contracts/performance.md#efficient-algorithms P predicates cost one metadata request each, one more per read file, one enumeration per observed directory listing and the bytes of only the files whose proof moved; physical resolution is shared per directory.
   * @evidence contracts/performance.md#reuse-equivalent-work A stored result is reused under equal answers to the questions that produced it, the same condition under which the compiler itself would rebuild it identically.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Enumeration lists and resolved directories are call-local; the session keeps its own rows and no handle is retained.
   */
  export function replay(
    observations: Readonly<
      Record<string, ITtscCompilerTransformation.IInputObservation>
    >,
    excluded: string,
    contents: RuntimeInputContents.Session,
  ): string | undefined {
    const resolved = new Map<string, string | null>();
    const native = (file: string): string | null => {
      let current = resolved.get(file);
      if (current === undefined) {
        current = physical(file);
        resolved.set(file, current);
      }
      return current;
    };
    try {
      for (const [file, observed] of Object.entries(observations)) {
        const relative = path.relative(excluded, file);
        if (
          relative === "" ||
          (!path.isAbsolute(relative) &&
            relative !== ".." &&
            !relative.startsWith(".." + path.sep))
        )
          continue;
        if (observed.nativePredicates !== undefined) return file;
        let kind: "file" | "directory" | "missing" = "missing";
        try {
          kind = fs.statSync(file).isDirectory() ? "directory" : "file";
        } catch (error) {
          if (!missing(error)) return file;
        }
        if (
          (observed.fileExists !== undefined &&
            observed.fileExists !== (kind === "file")) ||
          (observed.directoryExists !== undefined &&
            observed.directoryExists !== (kind === "directory")) ||
          (observed.stat !== undefined && observed.stat !== kind)
        )
          return file;
        // The session's row carries the file's physical path with its hash.
        let row: RuntimeInputContents.Row | undefined;
        if (observed.readFile !== undefined) {
          if (observed.readFile.ok) {
            if (kind !== "file") return file;
            row = contents.observe([file])[0]!;
            if (row[2] !== observed.readFile.hash) return file;
          } else if (kind === "file") return file;
        }
        if (observed.realpath !== undefined) {
          if (!observed.realpath.ok) {
            if (kind !== "missing") return file;
          } else if (
            kind === "missing" ||
            ((row?.[1] ?? null) !== observed.realpath.path &&
              native(file) !== observed.realpath.path)
          )
            return file;
        }
        if (
          observed.accessibleEntries !== undefined &&
          !entriesHold(file, observed.accessibleEntries)
        )
          return file;
      }
      return undefined;
    } catch {
      return "";
    }
  }

  /**
   * The content codec of a compiler's read observations: SHA-256 of the text
   * the compiler host returned, with a UTF-8 byte-order mark removed and UTF-16
   * decoded, as the producer hashes it. Its name keeps these records apart from
   * raw-byte ones, so the two kinds of hash are never compared. The replay,
   * which owns this codec's use, states its grounds.
   */
  export const textCodec: RuntimeInputContents.Codec = {
    name: "compiler-text",
    digest: (bytes) => textHash(bytes),
  };

  /** Compare a recorded directory listing with the compiler's current view. */
  function entriesHold(
    file: string,
    recorded: { directories: string[]; files: string[] },
  ): boolean {
    const current = listEntries(file) ?? { directories: [], files: [] };
    return JSON.stringify(current) === JSON.stringify(recorded);
  }

  /**
   * A directory's entries as the compiler's enumeration sees them: names of
   * subdirectories and files, links classified by their targets, inaccessible
   * targets omitted, each list sorted by UTF-8 bytes. Undefined when the
   * directory cannot be listed.
   *
   * @evidence contracts/common.md#principled-implementation The view follows links and omits unclassifiable entries as the compiler's own enumeration does, so a recorded and a current listing compare the same thing.
   * @evidence contracts/common.md#clear-and-simple-design One projection serves recording and replay.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A listing failure is reported, not turned into an empty directory, so a recorder can record absence instead.
   * @evidence contracts/common.md#meaningful-documentation The prose states classification, omission, order and the failure result.
   * @evidence contracts/portability.md#os-neutral-implementation Native readdir and following stat classify entries; names are compared as returned, ordered by UTF-8 bytes.
   * @evidence contracts/performance.md#efficient-algorithms One readdir, one stat per link and an O(n log n) sort of the names.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A fresh observation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned lists belong to the caller; no handle is retained.
   */
  export function listEntries(
    file: string,
  ): { directories: string[]; files: string[] } | undefined {
    const directories: string[] = [];
    const files: string[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(file, { withFileTypes: true });
    } catch {
      return undefined;
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
    return {
      directories: directories.sort(compare),
      files: files.sort(compare),
    };
  }
  /** Compare one compiler query record with the corresponding current queries. */
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

  /** Hash compiler-decoded text, retaining the BOM and UTF-16 producer policy. */
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

  /** Obtain a current physical coordinate, with null only for native absence. */
  function physical(file: string): string | null {
    try {
      return fs.realpathSync.native(file);
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  /** Classify only native absent-path errors. */
  function missing(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    );
  }

  /** SHA-256 of supplied text or raw bytes. */
  function digest(bytes: string | Buffer): string {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}
