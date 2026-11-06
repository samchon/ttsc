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
 * @evidence contracts/performance.md#bound-retention-and-release-resources Artifacts are capped at 128 MiB; readers retain only coordinates, sizes and hashes and use a 64 KiB validation buffer. Finally attempts descriptor closure; native close failure propagates without certifying release.
 */
export class RuntimeEmitBundle {
  /** Private runtime artifact; native aliases require physical restoration. */
  public static readonly filename = ".ttsc-completed-emit";
  private static readonly magic = Buffer.from("TTSCBND2");
  private static readonly maxBytes = 128 * 1024 * 1024;

  /** Physical private root represented by the relative output coordinates. */
  public readonly root: string;
  private readonly ranges: ReadonlyMap<string, [number, number, string]>;

  /** Retain only the validated index and immutable artifact boundaries. */
  private constructor(
    root: string,
    outputs: [string, number, number, string][],
    private readonly dataOffset: number,
    private readonly fileSize: number,
  ) {
    this.root = fs.realpathSync.native(root);
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
    const names = new Set<string>();
    const index: [string, number, number, string][] = [];
    let size = 0;
    for (const output of outputs) {
      if (
        !Array.isArray(output) ||
        output.length !== 2 ||
        typeof output[0] !== "string" ||
        typeof output[1] !== "string" ||
        !this.safeRelative(output[0]) ||
        names.has(output[0])
      )
        throw new Error("invalid runtime output bundle population");
      const bytes = Buffer.from(output[1], "base64");
      if (bytes.toString("base64") !== output[1])
        throw new Error("invalid runtime output bundle bytes");
      names.add(output[0]);
      index.push([output[0], size, bytes.length, this.digest(bytes)]);
      size += bytes.length;
    }
    for (const [name, encoded] of outputs) {
      if (!/\.(?:[cm]?js|jsx)$/i.test(name)) continue;
      const url = /\/\/[#@] sourceMappingURL=([^\r\n]*)[ \t\r\n]*$/
        .exec(Buffer.from(encoded, "base64").toString("utf8"))?.[1]
        ?.trim();
      if (
        url &&
        !url.startsWith("data:") &&
        (url !== path.basename(name) + ".map" || !names.has(name + ".map"))
      )
        return false;
    }
    const payload = JSON.stringify(index);
    const metadata = Buffer.from(
      JSON.stringify({ payload, hash: this.digest(payload) }),
    );
    if (12 + metadata.length + size > this.maxBytes) return false;
    const prefix = Buffer.alloc(12);
    this.magic.copy(prefix);
    prefix.writeUInt32LE(metadata.length, 8);
    const file = path.join(root, this.filename);
    const fd = fs.openSync(file, "wx");
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
      // Reserve output parents before the virtual layout adds authored links.
      for (const directory of new Set(
        outputs.map(([name]) => path.dirname(path.join(root, name))),
      ))
        fs.mkdirSync(directory, { recursive: true });
      this.writeAll(fd, prefix);
      this.writeAll(fd, metadata);
      for (const [, encoded] of outputs)
        this.writeAll(fd, Buffer.from(encoded, "base64"));
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
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size < 12 ||
      stat.size > this.maxBytes
    )
      throw new Error("invalid runtime output bundle file");
    const fd = fs.openSync(file, "r");
    try {
      const prefix = Buffer.alloc(12);
      this.readAll(fd, prefix, 0);
      const count = prefix.readUInt32LE(8);
      const start = 12 + count;
      if (!prefix.subarray(0, 8).equals(this.magic) || start > stat.size)
        throw new Error("invalid runtime output bundle header");
      const metadata = Buffer.alloc(count);
      this.readAll(fd, metadata, 12);
      const document = JSON.parse(metadata.toString("utf8"));
      if (
        typeof document.payload !== "string" ||
        document.hash !== this.digest(document.payload)
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
            row[2] > stat.size - start - end ||
            typeof row[3] !== "string" ||
            !/^[a-f0-9]{64}$/.test(row[3])
          )
            return false;
          names.add(row[0]);
          end += row[2];
          return true;
        }) ||
        end !== stat.size - start
      )
        throw new Error("invalid runtime output bundle population");
      const rows = outputs as [string, number, number, string][];
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
      return new RuntimeEmitBundle(root, rows, start, stat.size);
    } finally {
      fs.closeSync(fd);
    }
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
   * Read one exact recorded output; absence grants no filesystem fallback.
   *
   * @evidence contracts/common.md#principled-implementation Exact native relative coordinates select one admitted range; current size and its content hash must still match before UTF-8 text is returned.
   * @evidence contracts/common.md#clear-and-simple-design The index owns lookup and bounded range reading together without retaining decoded bodies.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown or outside names return null and cannot adopt authored bytes through the virtual layout.
   * @evidence contracts/common.md#meaningful-documentation The prose states exact membership and no filesystem fallback.
   * @evidence contracts/portability.md#os-neutral-implementation A direct miss may resolve the real parent to preserve directory aliases; no filename case policy is guessed.
   * @evidence contracts/performance.md#efficient-algorithms One map lookup and optional parent realpath precede reading and hashing only the requested B bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work One admitted immutable range index serves all reads while Node owns loaded-module caching.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Finally attempts descriptor closure and a close failure propagates without certifying release. Successful reads transfer text to the caller without retaining a buffer or per-module history.
   */
  public read(file: string): string | null {
    const resolved = path.resolve(file);
    let range = this.ranges.get(path.relative(this.root, resolved));
    if (range === undefined) {
      try {
        const physical = path.join(
          fs.realpathSync.native(path.dirname(resolved)),
          path.basename(resolved),
        );
        range = this.ranges.get(path.relative(this.root, physical));
      } catch {
        /* An unobservable parent supplies no output. */
      }
    }
    if (range === undefined) return null;
    const fd = fs.openSync(
      path.join(this.root, RuntimeEmitBundle.filename),
      "r",
    );
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.size !== this.fileSize)
        throw new Error("runtime output bundle changed");
      const [offset, size, expected] = range;
      const bytes = Buffer.alloc(size);
      RuntimeEmitBundle.readAll(fd, bytes, this.dataOffset + offset);
      if (RuntimeEmitBundle.digest(bytes) !== expected)
        throw new Error("runtime output bundle changed");
      return bytes.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
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
