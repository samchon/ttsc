import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Run-owned completed emit bytes with an in-memory range index. Opening
 * validates every byte through bounded buffers; reading one module retains no
 * other output's body. A run owns its artifact independently of persistent
 * cache collection. The artifact is immutable until that run is released.
 *
 * @evidence contracts/common.md#principled-implementation A checksummed normalized range index covers the complete bounded body without gaps; each output hash is verified at open and again when read.
 * @evidence contracts/common.md#clear-and-simple-design One owner handles private byte storage; producer admission and source ownership remain with their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing names never adopt authored bytes. Outputs requiring native map lookup or colliding with the private artifact retain physical restoration.
 * @evidence contracts/common.md#meaningful-documentation The prose states run ownership, immutable storage, complete validation and body retention policy.
 * @evidence contracts/portability.md#os-neutral-implementation Native path grammar and file identity reject escapes and artifact aliases without inferring case policy from OS names.
 * @evidence contracts/performance.md#efficient-algorithms Writing and full validation visit B body bytes and N names; retained state scales with the index, and a read allocates only its requested output.
 * @evidence contracts/performance.md#reuse-equivalent-work One immutable run artifact supplies its complete admitted generation; independent run storage survives persistent cache collection.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Artifacts are capped at 128 MiB; readers retain coordinates, sizes, hashes and, once an output is read, one descriptor per artifact until release() or process exit; validation uses a 64 KiB buffer and closes its own descriptor in finally.
 */
export class RuntimeEmitBundle {
  /** Private runtime artifact; native aliases require physical restoration. */
  public static readonly filename = ".ttsc-completed-emit";
  private static readonly magic = Buffer.from("TTSCBND2");
  private static readonly maxBytes = 128 * 1024 * 1024;

  /** Physical private root represented by the relative output coordinates. */
  public readonly root: string;

  /** The root's spelling followed by a separator, for {@link locate}. */
  private readonly prefix: string;
  private readonly ranges: ReadonlyMap<string, [number, number, string]>;

  /** Physical spellings of the parent directories reads have named. */
  private readonly parents = new Map<string, string>();

  /** Descriptor serving reads, opened by the first one and kept for the rest. */
  private descriptor: number | undefined;

  /** Artifacts holding an open descriptor, for {@link release}. */
  private static readonly reading = new Set<RuntimeEmitBundle>();

  /** Retain only the validated index and immutable artifact boundaries. */
  private constructor(
    root: string,
    outputs: [string, number, number, string][],
    private readonly dataOffset: number,
  ) {
    this.root = fs.realpathSync.native(root);
    this.prefix = this.root + path.sep;
    this.ranges = new Map(
      outputs.map(([name, offset, size, hash]) => [name, [offset, size, hash]]),
    );
  }

  /**
   * Write one run-owned artifact, or return false to restore ordinary files.
   * Noncanonical or external source-map references need native file lookup;
   * their completed build remains reusable through physical restoration.
   *
   * @evidence contracts/common.md#principled-implementation Validated encoded inputs become contiguous raw ranges with individual hashes and a checksummed index. Native top-component identity detects artifact-name collisions before directory creation.
   * @evidence contracts/common.md#clear-and-simple-design The boolean selects representation only; the cache owner keeps admission, producer execution and physical restoration policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only exact recorded sibling map references use virtual lookup; other references retain native semantics without guessed case folding or filesystem fallback for JavaScript.
   * @evidence contracts/common.md#meaningful-documentation The prose specifies the physical fallback, run ownership and unchanged completed-build reuse.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat compares artifact device/inode against each first component; native directory and exclusive file operations preserve actual alias policy.
   * @evidence contracts/performance.md#efficient-algorithms Validation, hashing and writing scale with input bytes and names; one directory operation per distinct parent precedes sequential body writes, and only one decoded output buffer is needed at a time.
   * @evidence contracts/performance.md#reuse-equivalent-work Representation refusal still permits the caller to reuse the admitted complete emit as ordinary files.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns run storage. Finally attempts closure and removes incomplete owned artifacts, including after a failed close; close/removal errors propagate and may retain resources. Total file bytes are capped before creation.
   */
  public static write(root: string, outputs: [string, string][]): boolean {
    const decoded: [string, Buffer][] = [];
    for (const output of outputs) {
      if (
        !Array.isArray(output) ||
        output.length !== 2 ||
        typeof output[0] !== "string" ||
        typeof output[1] !== "string"
      )
        throw new Error("invalid runtime output bundle population");
      const bytes = Buffer.from(output[1], "base64");
      if (bytes.toString("base64") !== output[1])
        throw new Error("invalid runtime output bundle bytes");
      decoded.push([output[0], bytes]);
    }
    const composed = this.compose(decoded, undefined);
    if (!composed.bundleable || composed.size > this.maxBytes) return false;
    return this.place(root, decoded, (fd) => {
      this.writeAll(fd, composed.head);
      for (const [, bytes] of decoded) this.writeAll(fd, bytes);
    });
  }

  /**
   * Write a completed emit's outputs and its owner's annex as one persistent
   * document in this artifact's format, at `file`, which must not exist.
   *
   * WARNING (samchon/ttsc#1852): a persistent document holds raw bytes in the
   * run artifact's own layout, never encoded text. The earlier document was
   * JSON carrying every output as base64 inside a second JSON string, so each
   * warm start parsed the whole document twice and decoded every output three
   * times before writing the same bytes back out: seconds per project for
   * documents of tens of megabytes, and a third more disk. A document in this
   * layout is restored by one file copy.
   *
   * @param file Absolute path of the document to create.
   * @param outputs Relative output coordinates and their exact bytes.
   * @param annex Owner text stored beside the index under its own checksum,
   *   such as the checksum of the record these outputs belong to.
   * @evidence contracts/common.md#principled-implementation The document is the artifact itself: a checksummed range index, a checksummed annex and contiguous raw bodies whose hashes the index carries, so restoring it changes no byte.
   * @evidence contracts/common.md#clear-and-simple-design One layout serves persistent and run-owned storage; the cache owner keeps keying, admission and publication.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid or duplicate coordinates throw before anything is created, and an existing path is never replaced.
   * @evidence contracts/common.md#meaningful-documentation The prose states the layout, the regression it prevents and each parameter's role.
   * @evidence contracts/portability.md#os-neutral-implementation Coordinates are validated native relative paths; one exclusive create and sequential writes use Node file semantics only.
   * @evidence contracts/performance.md#efficient-algorithms One hash pass over B body bytes and one sequential write; the index and annex are serialized once.
   * @evidence contracts/performance.md#reuse-equivalent-work A published document supplies every later run's artifact by copy, without re-encoding.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The descriptor is closed in finally and a document left incomplete is removed; the caller bounds total bytes before calling.
   */
  public static archive(
    file: string,
    outputs: readonly [string, Buffer][],
    annex: string,
  ): void {
    const composed = this.compose(outputs, annex);
    const fd = fs.openSync(file, "wx");
    let completed = false;
    try {
      this.writeAll(fd, composed.head);
      for (const [, bytes] of outputs) this.writeAll(fd, bytes);
      completed = true;
    } finally {
      try {
        fs.closeSync(fd);
      } catch (error) {
        completed = false;
        throw error;
      } finally {
        if (!completed) fs.unlinkSync(file);
      }
    }
  }

  /**
   * Read a persistent document's index and annex without reading its bodies.
   * Throws for anything that is not a complete, self-consistent document.
   *
   * @param file Absolute path of a document written by {@link archive}.
   * @evidence contracts/common.md#principled-implementation Regular-file kind, size, magic, both metadata checksums, unique validated coordinates and contiguous ranges covering the whole body are established before any field is returned; body hashes are checked by whichever reader takes the bytes.
   * @evidence contracts/common.md#clear-and-simple-design The lookup needs the annex to decide; reading bodies is left to the restore it then chooses.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A document without an annex, such as a bare run artifact, is refused rather than read as an empty one.
   * @evidence contracts/common.md#meaningful-documentation The prose states what is validated here and what remains for the byte reader.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat refuses links and the shared coordinate grammar refuses escapes.
   * @evidence contracts/performance.md#efficient-algorithms Reads the fixed prefix and the metadata section only, independent of body size.
   * @evidence contracts/performance.md#reuse-equivalent-work One inspection serves the lookup's validation and the chosen restore's eligibility.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The descriptor is closed in finally; the returned strings belong to the caller.
   */
  public static inspect(file: string): {
    /** Owner text stored by {@link archive}. */
    annex: string;

    /** Whether a run may use the document as its artifact unchanged. */
    bundleable: boolean;

    /** Every stored relative output coordinate. */
    names: string[];
  } {
    const stat = fs.lstatSync(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size < 12 ||
      stat.size > this.maxBytes
    )
      throw new Error("invalid runtime output bundle file");
    const fd = fs.openSync(file, "r");
    try {
      const index = this.readIndex(fd, stat.size);
      if (index.annex === undefined)
        throw new Error("runtime output document has no annex");
      return {
        annex: index.annex,
        bundleable: index.bundleable,
        names: index.rows.map(([name]) => name),
      };
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Make a persistent document a run's own artifact in `root`: a hard link to
   * the immutable document, or a copy where links are refused. Returns false,
   * leaving nothing behind, when an output coordinate aliases the artifact's
   * name there; the caller then restores ordinary files.
   *
   * @param file A document {@link inspect} reported as bundleable.
   * @param root The run's empty private output directory.
   * @param names The document's output coordinates, from {@link inspect}.
   * @evidence contracts/common.md#principled-implementation The link names the document's immutable bytes and a copy is byte-identical, so the run artifact carries the document's index and hashes; native identity of the created file against each first output component detects a name collision before any reader trusts the layout.
   * @evidence contracts/common.md#clear-and-simple-design Placement rules are shared with write; only the byte source differs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An existing artifact is never replaced, and refusal removes the copy.
   * @evidence contracts/common.md#meaningful-documentation The prose states the copy, the refusal and the caller's fallback.
   * @evidence contracts/portability.md#os-neutral-implementation Exclusive native copy and lstat identity carry the host's alias rules; no case policy is assumed.
   * @evidence contracts/performance.md#efficient-algorithms One native link, or a copy of B bytes where links are refused, and one directory creation per distinct output parent; no body is decoded or hashed here.
   * @evidence contracts/performance.md#reuse-equivalent-work The run owns its copy, so collection of the document cannot remove an executing emit.
   * @evidence contracts/performance.md#bound-retention-and-release-resources No descriptor outlives the call; a refused copy is unlinked.
   */
  public static restore(file: string, root: string, names: string[]): boolean {
    return this.place(
      root,
      names.map((name) => [name]),
      undefined,
      file,
    );
  }

  /**
   * Restore a persistent document as ordinary files below `root`, verifying
   * each body against its recorded hash, and append every file written to
   * `restored` as it is created so a failure can be cleaned up by the caller.
   *
   * @param file A document written by {@link archive}.
   * @param root The run's private output directory.
   * @param restored Receives each created path, in order.
   * @evidence contracts/common.md#principled-implementation Each range is read, hashed and compared with the index before it is written exclusively, so a damaged body never becomes an output.
   * @evidence contracts/common.md#clear-and-simple-design The physical representation reads the same document the bundled one copies.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An existing file is never replaced and a mismatched body throws.
   * @evidence contracts/common.md#meaningful-documentation The prose states verification, exclusivity and the cleanup ledger.
   * @evidence contracts/portability.md#os-neutral-implementation Native joins place validated relative coordinates; directory creation is recursive and exclusive file creation refuses aliases.
   * @evidence contracts/performance.md#efficient-algorithms One read, hash and write per output; one output's bytes are held at a time.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each run needs its own files.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The descriptor is closed in finally; created files are the caller's from the moment they are listed.
   */
  public static extract(file: string, root: string, restored: string[]): void {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > this.maxBytes)
      throw new Error("invalid runtime output bundle file");
    const fd = fs.openSync(file, "r");
    try {
      const index = this.readIndex(fd, stat.size);
      for (const [name, offset, size, expected] of index.rows) {
        const bytes = Buffer.alloc(size);
        this.readAll(fd, bytes, index.start + offset);
        if (this.digest(bytes) !== expected)
          throw new Error("invalid runtime output bundle body");
        const target = path.join(root, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes, { flag: "wx" });
        restored.push(target);
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Validate a population and build the document head: prefix and metadata.
   * `bundleable` is false when a JavaScript output names a source map that is
   * not its own recorded sibling, which needs native file lookup.
   */
  private static compose(
    outputs: readonly [string, Buffer][],
    annex: string | undefined,
  ): { head: Buffer; size: number; bundleable: boolean } {
    const names = new Set<string>();
    const index: [string, number, number, string][] = [];
    let size = 0;
    for (const output of outputs) {
      if (
        !Array.isArray(output) ||
        output.length !== 2 ||
        typeof output[0] !== "string" ||
        !Buffer.isBuffer(output[1]) ||
        !this.safeRelative(output[0]) ||
        names.has(output[0])
      )
        throw new Error("invalid runtime output bundle population");
      names.add(output[0]);
      index.push([output[0], size, output[1].length, this.digest(output[1])]);
      size += output[1].length;
    }
    let bundleable = true;
    for (const [name, bytes] of outputs) {
      if (!/\.(?:[cm]?js|jsx)$/i.test(name)) continue;
      // The directive is the text's last line, so only a tail is decoded. A
      // longer last line is an inline map, which needs no file lookup.
      const url = /\/\/[#@] sourceMappingURL=([^\r\n]*)[ \t\r\n]*$/
        .exec(
          bytes.subarray(Math.max(0, bytes.length - 8192)).toString("utf8"),
        )?.[1]
        ?.trim();
      if (
        url &&
        !url.startsWith("data:") &&
        (url !== path.basename(name) + ".map" || !names.has(name + ".map"))
      ) {
        bundleable = false;
        break;
      }
    }
    const payload = JSON.stringify(index);
    const metadata = Buffer.from(
      JSON.stringify({
        payload,
        hash: this.digest(payload),
        ...(annex === undefined
          ? {}
          : { annex, annexHash: this.digest(annex), bundleable }),
      }),
    );
    const prefix = Buffer.alloc(12);
    this.magic.copy(prefix);
    prefix.writeUInt32LE(metadata.length, 8);
    return {
      head: Buffer.concat([prefix, metadata]),
      size: 12 + metadata.length + size,
      bundleable,
    };
  }

  /**
   * Create the artifact in `root`, from `fill` or by copying `source`, unless
   * an output's first component is the artifact itself under this host's alias
   * rules; then reserve each output's parent directory.
   */
  private static place(
    root: string,
    outputs: readonly (readonly [string, ...unknown[]])[],
    fill: ((fd: number) => void) | undefined,
    source?: string,
  ): boolean {
    const file = path.join(root, this.filename);
    if (source !== undefined)
      try {
        // A published document is immutable: it is replaced by renaming a new
        // file over its name, never rewritten. A link therefore gives the run
        // its own name for the same bytes without copying them, and removing
        // or replacing the document leaves the run's bytes in place.
        fs.linkSync(source, file);
      } catch {
        fs.copyFileSync(source, file, fs.constants.COPYFILE_EXCL);
      }
    const fd = fs.openSync(file, source === undefined ? "wx" : "r");
    let completed = false;
    try {
      const own = fs.fstatSync(fd, { bigint: true });
      for (const name of new Set(
        outputs.map(([name]) => name.split(path.sep)[0]!),
      )) {
        try {
          const stat = fs.lstatSync(path.join(root, name), { bigint: true });
          if (stat.dev === own.dev && stat.ino === own.ino) return false;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      // Output coordinates resolve through their native parent directories.
      for (const directory of new Set(
        outputs.map(([name]) => path.dirname(path.join(root, name))),
      ))
        fs.mkdirSync(directory, { recursive: true });
      fill?.(fd);
      completed = true;
      return true;
    } finally {
      try {
        fs.closeSync(fd);
      } catch (error) {
        completed = false;
        throw error;
      } finally {
        if (!completed) fs.unlinkSync(file);
      }
    }
  }

  /**
   * Read and validate the prefix and metadata of an open artifact of `size`
   * bytes: magic, both checksums, the coordinate grammar and contiguous ranges
   * covering exactly the body.
   */
  private static readIndex(
    fd: number,
    size: number,
  ): {
    rows: [string, number, number, string][];
    start: number;
    annex: string | undefined;
    bundleable: boolean;
  } {
    const prefix = Buffer.alloc(12);
    this.readAll(fd, prefix, 0);
    const count = prefix.readUInt32LE(8);
    const start = 12 + count;
    if (!prefix.subarray(0, 8).equals(this.magic) || start > size)
      throw new Error("invalid runtime output bundle header");
    const metadata = Buffer.alloc(count);
    this.readAll(fd, metadata, 12);
    const document = JSON.parse(metadata.toString("utf8"));
    if (
      typeof document.payload !== "string" ||
      document.hash !== this.digest(document.payload) ||
      (document.annex !== undefined &&
        (typeof document.annex !== "string" ||
          document.annexHash !== this.digest(document.annex)))
    )
      throw new Error("invalid runtime output bundle checksum");
    const outputs: unknown = JSON.parse(document.payload);
    const names = new Set<string>();
    let end = 0;
    if (
      !Array.isArray(outputs) ||
      !outputs.every((row) => {
        if (
          !Array.isArray(row) ||
          row.length !== 4 ||
          typeof row[0] !== "string" ||
          !this.safeRelative(row[0]) ||
          names.has(row[0]) ||
          row[1] !== end ||
          !Number.isSafeInteger(row[2]) ||
          row[2] < 0 ||
          row[2] > size - start - end ||
          typeof row[3] !== "string" ||
          !/^[a-f0-9]{64}$/.test(row[3])
        )
          return false;
        names.add(row[0]);
        end += row[2];
        return true;
      }) ||
      end !== size - start
    )
      throw new Error("invalid runtime output bundle population");
    return {
      rows: outputs as [string, number, number, string][],
      start,
      annex: document.annex,
      bundleable: document.bundleable === true,
    };
  }

  /**
   * Validate complete run storage, returning undefined only for absence.
   *
   * @evidence contracts/common.md#principled-implementation Regular-file kind, size, magic, metadata checksum, unique native coordinates and contiguous ranges are validated before all output hashes are streamed and compared.
   * @evidence contracts/common.md#clear-and-simple-design One opener returns the index only after the complete artifact is admitted; no partial population escapes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Corrupt, inaccessible or nonordinary storage throws; only ENOENT denotes an ordinary physical generation.
   * @evidence contracts/common.md#meaningful-documentation The prose distinguishes absence from validation failure and promises complete storage validation.
   * @evidence contracts/portability.md#os-neutral-implementation Native lstat rejects links and path grammar rejects absolute, parent, dot, null and drive-relative coordinates.
   * @evidence contracts/performance.md#efficient-algorithms Opening reads all B body bytes through one reusable 64 KiB buffer and parses N index entries; it retains no decoded body population.
   * @evidence contracts/performance.md#reuse-equivalent-work The returned index serves the same immutable run-owned artifact across module requests without retaining their text.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Finally attempts descriptor closure; a close failure propagates without certifying release. Bounded metadata and validation buffers are temporary, while only the range index belongs to the returned owner.
   */
  public static open(root: string): RuntimeEmitBundle | undefined {
    const file = path.join(root, this.filename);
    let stat: fs.BigIntStats;
    try {
      stat = fs.lstatSync(file, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size < 12n ||
      stat.size > BigInt(this.maxBytes)
    )
      throw new Error("invalid runtime output bundle file");
    const size = Number(stat.size);
    const fd = fs.openSync(file, "r");
    try {
      const { rows, start } = this.readIndex(fd, size);
      const buffer = Buffer.alloc(64 * 1024);
      for (const [, offset, size, expected] of rows) {
        const hash = crypto.createHash("sha256");
        for (let read = 0; read < size; ) {
          const part = buffer.subarray(0, Math.min(buffer.length, size - read));
          this.readAll(fd, part, start + offset + read);
          hash.update(part);
          read += part.length;
        }
        if (hash.digest("hex") !== expected)
          throw new Error("invalid runtime output bundle body");
      }
      const bundle = new RuntimeEmitBundle(root, rows, start);
      this.validated.set(path.resolve(file), {
        signature: this.signature(stat),
        bundle,
      });
      return bundle;
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * {@link open} for the owners of one run, which ask about the same artifact
   * several times: whether a generation emitted anything, its inventory, and
   * its ownership index. The artifact is validated whole once per process and
   * file state; later calls return that index while the file keeps its
   * identity, size and stamps. Every read still verifies the hash of the range
   * it returns, so a body changed afterwards is never served
   * (samchon/ttsc#1852).
   *
   * @evidence contracts/common.md#principled-implementation The first call is a complete validation; reuse requires the same native identity, size and both stamps, and each read independently re-verifies its range hash and the file size.
   * @evidence contracts/common.md#clear-and-simple-design One memo serves the run's repeated queries; direct callers that must observe current validation keep using open.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Absence and invalid storage behave as in open; the memo never answers for a file whose metadata moved.
   * @evidence contracts/common.md#meaningful-documentation The prose states who calls it, the reuse condition and why serving stays safe.
   * @evidence contracts/portability.md#os-neutral-implementation Native bigint lstat supplies device, inode, size and nanosecond stamps.
   * @evidence contracts/performance.md#efficient-algorithms A repeated call costs one lstat instead of hashing every body.
   * @evidence contracts/performance.md#reuse-equivalent-work Callers in one process share one validated index per unchanged artifact.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The memo keeps one index per artifact opened in the process, without eviction; run artifacts are few per process.
   */
  public static shared(root: string): RuntimeEmitBundle | undefined {
    const file = path.join(root, this.filename);
    const known = this.validated.get(path.resolve(file));
    if (known !== undefined)
      try {
        if (
          this.signature(fs.lstatSync(file, { bigint: true })) ===
          known.signature
        )
          return known.bundle;
      } catch {
        /* open reports absence and failure itself. */
      }
    return this.open(root);
  }

  /** Artifacts this process validated whole, by path, with their metadata. */
  private static readonly validated = new Map<
    string,
    { signature: string; bundle: RuntimeEmitBundle }
  >();

  /** Identity, size and both stamps of an artifact. */
  private static signature(stat: fs.BigIntStats): string {
    return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(
      ":",
    );
  }

  /**
   * Relative JavaScript inventory in protocol order; it supplies no provenance.
   *
   * @evidence contracts/common.md#principled-implementation Only validated names with supported JavaScript suffixes enter the inventory.
   * @evidence contracts/common.md#clear-and-simple-design One projection serves inventory without recursive filesystem enumeration.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Names cannot establish which authored source produced an output.
   * @evidence contracts/common.md#meaningful-documentation The prose identifies relative protocol order and separate provenance authority.
   * @evidence contracts/portability.md#os-neutral-implementation Native separators become protocol slashes only in the returned inventory.
   * @evidence contracts/performance.md#efficient-algorithms Visits N names and sorts J JavaScript coordinates without body reads.
   * @evidence contracts/performance.md#reuse-equivalent-work The validated index supplies inventory for the immutable generation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned array belongs to its caller and no query history is retained.
   */
  public outputs(): string[] {
    return [...this.ranges.keys()]
      .filter((name) => /\.(?:[cm]?js|jsx)$/i.test(name))
      .map((name) => name.split(path.sep).join("/"))
      .sort();
  }

  /**
   * Resolve a private output coordinate through its native parent when needed.
   * This establishes containment only; inventory and provenance remain
   * separate.
   *
   * @evidence contracts/common.md#principled-implementation A normalized descendant must reconstruct the exact absolute spelling; otherwise native parent realpath supplies a second containment check without following the virtual output leaf.
   * @evidence contracts/common.md#clear-and-simple-design One coordinate owner serves reads and provenance validation with the same native alias rules.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A case-folded relative path alone cannot establish containment, and a contained coordinate supplies no output membership or source ownership.
   * @evidence contracts/common.md#meaningful-documentation The prose distinguishes private containment, native parent resolution and independent ownership.
   * @evidence contracts/portability.md#os-neutral-implementation Exact path reconstruction rejects distinct native siblings even when Node relative-path comparison folds case; parent realpath admits actual directory aliases without OS-name dispatch.
   * @evidence contracts/performance.md#efficient-algorithms Canonical descendants require only path operations; other spellings attempt one parent realpath and repeat the bounded path check.
   * @evidence contracts/performance.md#reuse-equivalent-work The immutable physical root serves all coordinates without caching mutable alias observations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each call returns its coordinate and retains no native handle or alias history.
   */
  public resolve(file: string): string | null {
    return this.locate(file)?.[0] ?? null;
  }

  /**
   * {@link resolve}, with the coordinate's name relative to the root. A
   * normalized spelling below the root's own spelling is its name by
   * construction, which every module read asks for; any other spelling takes
   * the native containment check.
   */
  private locate(file: string): [string, string] | null {
    const absolute = path.resolve(file);
    if (absolute.startsWith(this.prefix)) {
      const name = absolute.slice(this.prefix.length);
      if (name.length !== 0 && name !== "." && name !== "..")
        return [absolute, name];
    }
    const contained = (candidate: string): [string, string] | null => {
      const relative = path.relative(this.root, candidate);
      return RuntimeEmitBundle.safeRelative(relative) &&
        path.join(this.root, relative) === candidate
        ? [candidate, relative]
        : null;
    };
    const direct = contained(absolute);
    if (direct !== null) return direct;
    try {
      // The run owns this private layout and never moves it, so each parent
      // spelling is resolved once instead of once per module read.
      const parent = path.dirname(absolute);
      let resolved = this.parents.get(parent);
      if (resolved === undefined) {
        resolved = fs.realpathSync.native(parent);
        this.parents.set(parent, resolved);
      }
      return contained(path.join(resolved, path.basename(absolute)));
    } catch {
      return null;
    }
  }

  /**
   * Read one exact recorded output; absence grants no filesystem fallback.
   *
   * @evidence contracts/common.md#principled-implementation Exact native relative coordinates select one admitted range; the complete range must still be readable and match its content hash before UTF-8 text is returned.
   * @evidence contracts/common.md#clear-and-simple-design The index owns lookup and bounded range reading together without retaining decoded bodies.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown or outside names return null and cannot adopt authored bytes from the filesystem.
   * @evidence contracts/common.md#meaningful-documentation The prose states exact membership and no filesystem fallback.
   * @evidence contracts/portability.md#os-neutral-implementation Shared coordinate resolution preserves native directory aliases and rejects distinct siblings; no filename case policy is guessed.
   * @evidence contracts/performance.md#efficient-algorithms A spelling below the root costs one prefix comparison and one map lookup, other spellings an optional parent realpath; then only the requested B bytes are read and hashed through the artifact's one retained descriptor.
   * @evidence contracts/performance.md#reuse-equivalent-work One admitted immutable range index serves all reads while Node owns loaded-module caching.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The first read opens one descriptor that later reads share, held until release() or process exit. Successful reads transfer text to the caller without retaining a buffer or per-module history.
   */
  public read(file: string): string | null {
    const located = this.locate(file);
    if (located === null) return null;
    const range = this.ranges.get(located[1]);
    if (range === undefined) return null;
    // One descriptor serves every read of this artifact: opening it again for
    // each module was the largest single cost of a warm start, since a host
    // may inspect the whole artifact on every open (samchon/ttsc#1852).
    if (this.descriptor === undefined) {
      this.descriptor = fs.openSync(
        path.join(this.root, RuntimeEmitBundle.filename),
        "r",
      );
      RuntimeEmitBundle.reading.add(this);
    }
    // The range's own hash decides: a truncated artifact fails the read and
    // changed bytes fail the hash, so the descriptor's metadata is not asked
    // again for every module.
    const fd = this.descriptor;
    const [offset, size, expected] = range;
    const bytes = Buffer.alloc(size);
    RuntimeEmitBundle.readAll(fd, bytes, this.dataOffset + offset);
    if (RuntimeEmitBundle.digest(bytes) !== expected)
      throw new Error("runtime output bundle changed");
    return bytes.toString("utf8");
  }

  /**
   * Close the descriptor of every artifact this process has read from. An owner
   * that removes run storage inside the reading process calls it first, since
   * an open file can keep its directory from being removed; a later read opens
   * its artifact again. Close failures are ignored: the process is giving the
   * storage up.
   *
   * @evidence contracts/common.md#principled-implementation Every retained descriptor is registered when it is opened, so one call releases exactly the open population.
   * @evidence contracts/common.md#clear-and-simple-design One release point serves each owner that removes storage in-process; readers reopen on demand and need no state of their own.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Nothing is closed that this class did not open, and no removal is attempted here.
   * @evidence contracts/common.md#meaningful-documentation The prose states who calls it, why, and what a later read does.
   * @evidence contracts/portability.md#os-neutral-implementation Closing before removal satisfies hosts that refuse to remove a directory holding an open file and is harmless elsewhere.
   * @evidence contracts/performance.md#efficient-algorithms One close per artifact that served a read.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Releasing handles shares no computation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The registry holds one entry per artifact with an open descriptor and is emptied here; process exit releases whatever no owner released.
   */
  public static release(): void {
    for (const bundle of RuntimeEmitBundle.reading) {
      try {
        if (bundle.descriptor !== undefined) fs.closeSync(bundle.descriptor);
      } catch {
        // The storage is being given up; nothing reads through it again.
      }
      bundle.descriptor = undefined;
    }
    RuntimeEmitBundle.reading.clear();
  }

  /** Read an entire bounded range or reject truncated storage. */
  private static readAll(fd: number, buffer: Buffer, position: number): void {
    for (let offset = 0; offset < buffer.length; ) {
      const count = fs.readSync(
        fd,
        buffer,
        offset,
        buffer.length - offset,
        position + offset,
      );
      if (count === 0) throw new Error("truncated runtime output bundle");
      offset += count;
    }
  }

  /** Synchronous writes can be partial; finish each owned buffer. */
  private static writeAll(fd: number, buffer: Buffer): void {
    for (let offset = 0; offset < buffer.length; ) {
      const count = fs.writeSync(fd, buffer, offset, buffer.length - offset);
      if (count === 0)
        throw new Error("incomplete runtime output bundle write");
      offset += count;
    }
  }

  /** A transported output is a normalized native private descendant. */
  private static safeRelative(name: string): boolean {
    return (
      name.length !== 0 &&
      !name.includes("\0") &&
      !path.isAbsolute(name) &&
      path.parse(name).root === "" &&
      path.normalize(name) === name &&
      name !== "." &&
      name !== ".." &&
      !name.startsWith(".." + path.sep)
    );
  }

  /** SHA-256 over exact bytes, including UTF-8 metadata text. */
  private static digest(bytes: string | Buffer): string {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}
