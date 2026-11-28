import fs from "node:fs";

/**
 * Native filesystem observations shared by descriptor checks, runtime hooks and
 * dependency locks.
 *
 * Missing-component errno classification and followed regular-file stat share
 * one meaning across lock recovery and the serve lanes. A code-shaped caller
 * value is not authenticated native evidence, and file kind is not proof of
 * readable contents or a pinned path identity.
 *
 * @evidence contracts/common.md#principled-implementation Missing-component code classification and followed regular-file stat are distinct predicates; they do not authenticate arbitrary error-shaped inputs or certify readable contents.
 * @evidence contracts/common.md#clear-and-simple-design Shared code owns native file-kind classification, guarded reads and physical identity encoding without retaining an alternate filesystem model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Predicates use documented Node fs and errno semantics; no consumer-specific path or foreign API replacement determines the answer.
 * @evidence contracts/common.md#meaningful-documentation The namespace describes the common decision boundary and each function documents its own missing-path or regular-file meaning.
 * @evidence contracts/portability.md#os-neutral-implementation Node's native stat and portable ENOENT/ENOTDIR error codes establish file type and absence without guessing from the host OS name.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace groups predicates and does not independently choose a computation strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace retains no query cache or in-flight computation; each predicate inspects its current argument.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace owns no retained state, handle or task.
 */
export namespace RuntimeFilesystem {
  // NUL cannot occur in a native path. The leading slash preserves the
  // absolute-path witness format through lexical normalization and JSON.
  const RAW_REALPATH_PREFIX = "/\0ttsc-raw/";

  /**
   * Resolve a native path for a physical identity comparison. POSIX paths
   * outside UTF-8 use a reserved byte witness. OS failures propagate.
   *
   * @evidence contracts/common.md#principled-implementation Native realpath supplies identity and a UTF-8 round trip chooses the representation.
   * @evidence contracts/common.md#clear-and-simple-design The descriptor subprocess and host share the witness producer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native failures propagate and lossy strings never become witnesses.
   * @evidence contracts/common.md#meaningful-documentation States the representation and native failure boundary.
   * @evidence contracts/portability.md#os-neutral-implementation Windows uses native string realpath while POSIX uses native buffer output.
   * @evidence contracts/performance.md#efficient-algorithms One native realpath followed by linear byte conversion and framing.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call observes current filesystem state.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The helper retains no resources beyond its returned witness.
   */
  export function realpathWitness(file: string | Buffer): string {
    if (process.platform === "win32") return fs.realpathSync.native(file);
    return nativePathWitness(
      fs.realpathSync.native(file, { encoding: "buffer" }),
    );
  }

  /**
   * Encode an absolute POSIX path for native observations and proof storage.
   *
   * @evidence contracts/common.md#principled-implementation A UTF-8 round trip produces the native spelling or a reserved base64url byte witness.
   * @evidence contracts/common.md#clear-and-simple-design Directory enumeration and realpath use one byte encoding.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An undecodable path never becomes a lossy spelling.
   * @evidence contracts/common.md#meaningful-documentation States the absolute-path input and purpose of the encoded result.
   * @evidence contracts/portability.md#os-neutral-implementation POSIX callers preserve raw filesystem bytes when UTF-8 cannot carry them.
   * @evidence contracts/performance.md#efficient-algorithms Encoding and verification scale with the bytes of one path.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation encodes only the supplied bytes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Temporary buffers and the returned text are local to one encoding.
   */
  export function nativePathWitness(bytes: Buffer): string {
    const spelling = bytes.toString();
    return Buffer.from(spelling).equals(bytes)
      ? spelling
      : RAW_REALPATH_PREFIX + bytes.toString("base64url");
  }

  /**
   * Recover the bytes from a POSIX physical-path witness. Ordinary native paths
   * have no NUL and continue to travel as paths.
   *
   * @evidence contracts/common.md#principled-implementation Decode only the reserved absolute witness spelling, then require a canonical, absolute NUL-free payload outside UTF-8.
   * @evidence contracts/common.md#clear-and-simple-design Readers needing native raw bytes use the decoder beside the witness producer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid payloads remain unavailable instead of becoming lossy native paths.
   * @evidence contracts/common.md#meaningful-documentation Distinguishes byte witnesses from directly usable native paths.
   * @evidence contracts/portability.md#os-neutral-implementation POSIX native paths accept non-UTF-8 bytes and reserve NUL; Windows does not produce or accept this witness.
   * @evidence contracts/performance.md#efficient-algorithms Prefix matching and one base64 decode plus canonical and UTF-8 checks scale with the witness length.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The value is decoded on demand without caching.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Temporary byte buffers belong to the call and the decoded result transfers to the reader.
   */
  export function rawRealpath(witness: string): Buffer | undefined {
    const prefix = RAW_REALPATH_PREFIX;
    if (process.platform === "win32" || !witness.startsWith(prefix))
      return undefined;
    const encoded = witness.slice(prefix.length);
    const bytes = Buffer.from(encoded, "base64url");
    return bytes[0] === 0x2f &&
      !bytes.includes(0) &&
      bytes.toString("base64url") === encoded &&
      !Buffer.from(bytes.toString()).equals(bytes)
      ? bytes
      : undefined;
  }

  /**
   * Read a path already observed as a regular file. A POSIX nonblocking open
   * avoids waiting on a pipe substituted after that observation. The opened
   * POSIX descriptor supplies the final regular-file check. Windows reads the
   * classified path directly.
   *
   * @evidence contracts/common.md#principled-implementation POSIX opens a nonblocking descriptor, verifies its type and reads that descriptor. Windows uses the regular-file observation supplied by the caller and its ordinary file read.
   * @evidence contracts/common.md#clear-and-simple-design Shares the guarded content-read boundary between host-input and LSP fingerprints.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Nonregular handles return undefined and native failures propagate for the caller's existing unavailable marker.
   * @evidence contracts/common.md#meaningful-documentation Documents the required preliminary file classification and how a replacement pipe is handled.
   * @evidence contracts/portability.md#os-neutral-implementation POSIX supplies O_NONBLOCK and checks the opened descriptor. Windows uses its ordinary readFileSync path.
   * @evidence contracts/performance.md#efficient-algorithms The Windows path uses one readFileSync. POSIX opens and verifies a descriptor before reading. Work and temporary memory scale with the bytes read.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A prior read cannot establish current content.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The descriptor closes in finally and only the caller retains the returned bytes.
   */
  export function readObservedRegularFile(
    candidate: string | Buffer,
  ): Buffer | undefined {
    if (process.platform === "win32") return fs.readFileSync(candidate);
    const descriptor = fs.openSync(
      candidate,
      fs.constants.O_RDONLY | fs.constants.O_NONBLOCK,
    );
    try {
      return fs.fstatSync(descriptor).isFile()
        ? fs.readFileSync(descriptor)
        : undefined;
    } finally {
      fs.closeSync(descriptor);
    }
  }

  /**
   * Whether an ordinarily readable code is ENOENT or ENOTDIR, the native
   * missing-component classifications. Nullish values or unrelated readable
   * codes return false. Accessor/proxy exceptions propagate; an arbitrary
   * caller-supplied code is not authenticated filesystem evidence.
   *
   * @evidence contracts/common.md#principled-implementation Only the two missing-component codes classify true; permission or other readable codes classify false. Native callers supply the provenance of their caught errors rather than this predicate authenticating unknown values.
   * @evidence contracts/common.md#clear-and-simple-design One code projection and two literal comparisons keep classification identical across callers without claiming total access to arbitrary objects.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No broad exception-to-absence fallback or expected path name replaces the documented errno distinction.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes code classification from authenticated absence and documents nullish/unrelated values and exceptional property access.
   * @evidence contracts/portability.md#os-neutral-implementation Node's documented errno codes represent native absence across hosts without inspecting platform-specific error message text.
   * @evidence contracts/performance.md#efficient-algorithms For native errors with ordinary code data, one property projection and two fixed literal comparisons allocate no traversal or history. Arbitrary caller accessors/proxies can perform work or throw; fixed predicate steps do not bound their behavior.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Error values are immediate caller inputs and establish no shared computation or invalidation boundary.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate retains no state or native resource.
   */
  export function isMissingPathError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return code === "ENOENT" || code === "ENOTDIR";
  }

  /**
   * Whether `candidate` exists and is a regular file, following links. Failed
   * stat calls return false, including missing and unreadable paths.
   *
   * @evidence contracts/common.md#principled-implementation Native stat follows links and classifies regular files rather than directories or special files; failure returns false, while success certifies only observed kind, not readable contents or stable identity.
   * @evidence contracts/common.md#clear-and-simple-design A single fs query and boolean failure boundary make the serve predicate independent of lock-error classification.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The answer comes from the actual filesystem type rather than filename extension or fixture path.
   * @evidence contracts/common.md#meaningful-documentation The native comment explains link following and failed-stat behavior so callers know false does not distinguish missing from denied access.
   * @evidence contracts/portability.md#os-neutral-implementation fs.statSync exposes the native file type and link behavior; native spelling is preserved without separator or case rewriting.
   * @evidence contracts/performance.md#efficient-algorithms One native stat classifies the supplied path without an explicit parent listing or content read; native path resolution/link traversal and latency are not bounded by that single call count.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work File existence and type may change between calls; this predicate owns no validity identity for cached answers.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous stat leaves no descriptor or task retained after the call.
   */
  export function isFile(candidate: string): boolean {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  }
}
