import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Run-owned completed emit bytes, stored in one checksummed file instead of
 * recreating every output. A build/index owns the decoded bundle; no global
 * generation map keeps past programs alive. Logical output paths still belong
 * to the private emit root and runtime module identities remain source paths.
 *
 * @evidence contracts/common.md#principled-implementation A checksummed ordered output population uses normalized private descendant names and canonical base64; a run owns its independent file and each reader decodes only requested outputs.
 * @evidence contracts/common.md#clear-and-simple-design One class owns bundle representation and reads; producer admission remains with RuntimeBuildCache and source ownership remains with EmitOwnershipIndex.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Bundle membership supplies bytes, never source provenance; malformed or aliased storage is rejected rather than guessed or followed.
 * @evidence contracts/common.md#meaningful-documentation The prose states run ownership, logical coordinates, lazy decode and the absence of retained global generations.
 * @evidence contracts/portability.md#os-neutral-implementation Native path containment and lstat preserve directory/file identity; no OS-name case folding or cache path becomes a module identity.
 * @evidence contracts/performance.md#efficient-algorithms One bounded file replaces O(outputs) creates/writes; parse and checksum scale with encoded bytes, while reads decode only the requested output and indexed names avoid directory scans.
 * @evidence contracts/performance.md#reuse-equivalent-work An admitted immutable run bundle serves all files of the same completed generation; fresh builds and later runs own distinct storage.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The run directory owns one file capped at 128 MiB; each owning index retains its encoded population until released, with no namespace-level population or open handle.
 */
export class RuntimeEmitBundle {
  /** Reserved private-runtime artifact, never an authored source coordinate. */
  public static readonly filename = ".ttsc-completed-emit";
  private static readonly format = "ttsx-emit-bundle-v1";
  private static readonly maxBytes = 128 * 1024 * 1024;

  /** The private native root represented by the relative output coordinates. */
  public readonly root: string;
  private readonly bytes: ReadonlyMap<string, string>;

  /** An owner retains only its validated population and private root. */
  private constructor(root: string, outputs: [string, string][]) {
    this.root = fs.realpathSync.native(root);
    this.bytes = new Map(outputs);
  }

  /**
   * Write independently owned bytes after producer and input admission.
   *
   * @evidence contracts/common.md#principled-implementation Canonical encoded outputs are checksummed as exact UTF-8 payload text and exclusively created in the caller-owned private root.
   * @evidence contracts/common.md#clear-and-simple-design One file write publishes the validated population after reserving distinct output parent directories for the virtual layout.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller must have admitted producer proof; this method changes no compiler policy or source identity.
   * @evidence contracts/common.md#meaningful-documentation The prose states admission order and independent output ownership.
   * @evidence contracts/portability.md#os-neutral-implementation Native join and exclusive file creation keep the artifact under the supplied private directory.
   * @evidence contracts/performance.md#efficient-algorithms Serialization and hashing scale with encoded bytes; one directory creation per distinct output parent precedes one output-file write.
   * @evidence contracts/performance.md#reuse-equivalent-work Each private run receives its own bytes, so persistent cache collection cannot remove an active run's emit.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The artifact follows the run directory lifetime; serialization is capped and this method retains no buffer or handle after returning.
   */
  public static write(root: string, outputs: [string, string][]): void {
    const payload = JSON.stringify(outputs);
    const text = JSON.stringify({
      format: this.format,
      payload,
      hash: this.digest(payload),
    });
    if (Buffer.byteLength(text) > this.maxBytes)
      throw new Error("runtime output bundle exceeds limit");
    this.validate(outputs);
    // Reserve compiler-output directories before the virtual layout mirrors
    // authored directories; a missing logical output must never follow a new
    // layout junction into the source tree.
    const directories = new Set(
      outputs.map(([name]) => path.dirname(path.join(root, name))),
    );
    for (const directory of directories)
      fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(root, this.filename), text, { flag: "wx" });
  }

  /**
   * Open a run artifact, or return undefined for an ordinary physical emit.
   * Corrupt or nonordinary artifacts throw before any bytes are served.
   *
   * @evidence contracts/common.md#principled-implementation Regular-file kind, bounded length, format, checksum, coordinate uniqueness and canonical base64 independently validate the bundle population.
   * @evidence contracts/common.md#clear-and-simple-design One opener owns representation validation and returns an invocation-owned byte index.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Only ENOENT means no bundle; corrupt or inaccessible artifacts cannot silently become another successful output generation.
   * @evidence contracts/common.md#meaningful-documentation The prose distinguishes ordinary absence from corrupt or nonordinary storage.
   * @evidence contracts/portability.md#os-neutral-implementation lstat refuses links; native descendant grammar rejects absolute, parent, dot, null and drive-relative coordinates.
   * @evidence contracts/performance.md#efficient-algorithms Read, checksum, parse and canonical-base64 validation scale with one bounded encoded population without creating its output files.
   * @evidence contracts/performance.md#reuse-equivalent-work The returned object serves the trusted immutable run artifact; owners retain it instead of reopening it per module.
   * @evidence contracts/performance.md#bound-retention-and-release-resources At most one bounded population belongs to the returned object; synchronous reads retain no descriptor and no static map retains it.
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
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > this.maxBytes)
      throw new Error("invalid runtime output bundle file");
    const document = JSON.parse(fs.readFileSync(file, "utf8"));
    if (
      document.format !== this.format ||
      typeof document.payload !== "string" ||
      document.hash !== this.digest(document.payload)
    )
      throw new Error("invalid runtime output bundle checksum");
    return new RuntimeEmitBundle(
      root,
      this.validate(JSON.parse(document.payload)),
    );
  }

  /**
   * Validate the complete population before creating directories or serving
   * bytes.
   */
  private static validate(outputs: unknown): [string, string][] {
    const names = new Set<string>();
    if (
      !Array.isArray(outputs) ||
      !outputs.every((output) => {
        if (
          !Array.isArray(output) ||
          output.length !== 2 ||
          typeof output[0] !== "string" ||
          typeof output[1] !== "string" ||
          !this.safeRelative(output[0]) ||
          names.has(output[0]) ||
          Buffer.from(output[1], "base64").toString("base64") !== output[1]
        )
          return false;
        names.add(output[0]);
        return true;
      })
    )
      throw new Error("invalid runtime output bundle population");
    return outputs as [string, string][];
  }

  /**
   * Relative JavaScript names from the validated population, in protocol order.
   *
   * @evidence contracts/common.md#principled-implementation Only validated output coordinates with supported JavaScript suffixes enter the returned inventory; the inventory supplies no source ownership.
   * @evidence contracts/common.md#clear-and-simple-design One projection replaces recursive output enumeration for a bundled generation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Filtering names does not infer which authored source produced them.
   * @evidence contracts/common.md#meaningful-documentation The prose states relative JavaScript-only inventory and protocol ordering.
   * @evidence contracts/portability.md#os-neutral-implementation Native separators become protocol slashes only in the returned relative inventory.
   * @evidence contracts/performance.md#efficient-algorithms The projection visits O output names and sorts selected JavaScript names without filesystem reads or content decode.
   * @evidence contracts/performance.md#reuse-equivalent-work The validated immutable population serves inventory requests; callers may retain the returned copy.
   * @evidence contracts/performance.md#bound-retention-and-release-resources A returned array belongs to its caller and this object stores no query history.
   */
  public outputs(): string[] {
    return [...this.bytes.keys()]
      .filter((name) => /\.(?:[cm]?js|jsx)$/i.test(name))
      .map((name) => name.split(path.sep).join("/"))
      .sort();
  }

  /**
   * Decode only an exact private output; absence grants no filesystem fallback.
   *
   * @evidence contracts/common.md#principled-implementation Exact private relative coordinates index canonical encoded bytes rather than a file that may have been linked into the virtual layout later.
   * @evidence contracts/common.md#clear-and-simple-design One lookup and decode serve JavaScript, maps and other recorded outputs through the same immutable population.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing or outside coordinate returns null and never adopts authored filesystem bytes.
   * @evidence contracts/common.md#meaningful-documentation The prose states exact private lookup and missing-output behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Native resolve/relative preserve the admitted root's coordinates without URL or global case rewriting.
   * @evidence contracts/performance.md#efficient-algorithms Path conversion and a map lookup precede decoding only B requested bytes; a direct miss adds one native parent realpath and another lookup without traversing other outputs.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated modules use the same admitted encoded population while Node owns loaded-module caching.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Decoded text transfers to the caller and is not retained beside every module by this object.
   */
  public read(file: string): string | null {
    const resolved = path.resolve(file);
    let value = this.bytes.get(path.relative(this.root, resolved));
    if (value === undefined) {
      // Logical files need not exist, but their reserved parent directories
      // let native identity resolve a caller's junction or 8.3 alias.
      try {
        const physical = path.join(
          fs.realpathSync.native(path.dirname(resolved)),
          path.basename(resolved),
        );
        value = this.bytes.get(path.relative(this.root, physical));
      } catch {
        /* An unobservable parent supplies no bundled output. */
      }
    }
    return value === undefined
      ? null
      : Buffer.from(value, "base64").toString("utf8");
  }

  /** A transported output must be a normalized native private descendant. */
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

  /** Exact UTF-8 payload checksum, independent of output coordinate relocation. */
  private static digest(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
  }
}
