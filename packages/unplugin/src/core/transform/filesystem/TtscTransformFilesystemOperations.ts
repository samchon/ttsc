import type fs from "node:fs";
import type { FilesystemPathIdentityOperations } from "ttsc/path-identity";

/**
 * Cache-owned synchronous filesystem reads used by transform validation.
 *
 * @evidence contracts/common.md#principled-implementation Capture and validation share one operation table, so evidence from different observed filesystems cannot be mixed implicitly.
 * @evidence contracts/common.md#clear-and-simple-design Read, path-policy, and optional watch capabilities form one structural boundary; proof algorithms remain in their consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit capability injection avoids native monkeypatching and does not introduce a production branch that recognizes test inputs.
 * @evidence contracts/common.md#meaningful-documentation Member comments distinguish ordinary versus bigint metadata, following versus link reads, and backend watch limitations.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral operations expose directory case and path-platform policy with native filesystem observations, without promising that one OS name determines every volume's capability.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscTransformFilesystemOperations only declares a shape; it has no
 *   computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscTransformFilesystemOperations only declares a shape; it has no work
 *   to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscTransformFilesystemOperations only declares a shape; it has no handle
 *   or retained state at runtime.
 */
export interface TtscTransformFilesystemOperations {
  /**
   * Optional native byte-preserving link text for contributor predicates.
   *
   * @evidence contracts/common.md#principled-implementation Raw native link text is retained independently of target bytes and metadata.
   * @evidence contracts/common.md#clear-and-simple-design An optional native capability preserves existing structural filesystem adapters; missing support refuses the corresponding predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native bytes are not replaced with decoded text or an OS-default guess.
   * @evidence contracts/common.md#meaningful-documentation The member comment identifies the byte-preserving query and contributor predicate consumer.
   * @evidence contracts/portability.md#os-neutral-implementation The supplied native view owns link and filename bytes; consumers choose its declared path dialect.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Only an operation signature is declared; the implementing view owns query cost.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This signature provides no independent cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This signature owns no resource lifetime.
   */
  readlink?(location: string | Buffer): Buffer;

  /**
   * Optional byte-preserving native directory names for contributor predicates.
   *
   * @evidence contracts/common.md#principled-implementation Byte-preserving entry names retain directory fingerprint meaning on native byte-name filesystems.
   * @evidence contracts/common.md#clear-and-simple-design An optional native capability preserves existing structural filesystem adapters; missing support refuses the corresponding predicate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native bytes are not replaced with decoded text or an OS-default guess.
   * @evidence contracts/common.md#meaningful-documentation The member comment identifies the byte-preserving query and contributor predicate consumer.
   * @evidence contracts/portability.md#os-neutral-implementation The supplied native view owns link and filename bytes; consumers choose its declared path dialect.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Only an operation signature is declared; the implementing view owns query cost.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This signature provides no independent cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This signature owns no resource lifetime.
   */
  readdirRaw?(location: string): fs.Dirent<Buffer>[];

  /** Override the case policy when the observed filesystem is not the host. */
  caseSensitive?: FilesystemPathIdentityOperations["caseSensitive"];

  /**
   * Test whether a validation or resolution candidate currently exists.
   *
   * @evidence contracts/common.md#principled-implementation Existence is a distinct observed predicate, not a substitute for file kind, readable content, or physical identity.
   * @evidence contracts/common.md#clear-and-simple-design One boolean query exposes the capability needed by selection and missing-input proofs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The view's actual observation supplies the answer rather than a filename exception or fabricated compiler proof.
   * @evidence contracts/common.md#meaningful-documentation The native comment states the resolution and validation ownership of the candidate query.
   * @evidence contracts/portability.md#os-neutral-implementation OS-neutral existence follows the supplied filesystem view instead of assuming native accessibility from path spelling.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of exists is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of exists is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of exists is declared here; the cost belongs to its
   *   implementation.
   */
  exists(location: string): boolean;

  /**
   * Read link metadata without following a symbolic link.
   *
   * @evidence contracts/common.md#principled-implementation Nonfollowing metadata preserves link topology separately from the target's content and regular stat result.
   * @evidence contracts/common.md#clear-and-simple-design BigIntStats carries device, identity, and nanosecond evidence in one native observation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Link metadata is not synthesized from target stat or inferred from a known path prefix.
   * @evidence contracts/common.md#meaningful-documentation The native comment specifies the nonfollowing distinction and the return type identifies exact metadata precision.
   * @evidence contracts/portability.md#os-neutral-implementation OS-neutral link evidence comes from the observing view's native device and metadata fields, including symlink and junction behavior.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of lstat is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of lstat is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of lstat is declared here; the cost belongs to its
   *   implementation.
   */
  lstat(location: string): fs.BigIntStats;

  /**
   * Read bytes used by project, graph, and host-input fingerprints.
   *
   * @evidence contracts/common.md#principled-implementation Raw bytes supply content evidence independently of timestamps and of compiler text normalization.
   * @evidence contracts/common.md#clear-and-simple-design A synchronous Buffer result exposes one read operation; each fingerprint owner chooses its required encoding and hash.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual bytes cannot be replaced by metadata or an expected transformed result solely to satisfy validation.
   * @evidence contracts/common.md#meaningful-documentation The comment names the proof consumers and Buffer preserves the raw-byte contract.
   * @evidence contracts/portability.md#os-neutral-implementation OS-neutral content reads use the supplied filesystem view without imposing line-ending conversion or path-case rewriting.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of readFile is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of readFile is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of readFile is declared here; the cost belongs to its
   *   implementation.
   */
  readFile(location: string): Buffer;

  /**
   * Enumerate one project or missing-input proof directory.
   *
   * @evidence contracts/common.md#principled-implementation Dirent observations supply both names and kinds needed by program walks and directory predicates.
   * @evidence contracts/common.md#clear-and-simple-design One directory read supplies the existing proof algorithms instead of exposing a second tree walker.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Enumeration does not silently remove names that happen to match known test or host directories.
   * @evidence contracts/common.md#meaningful-documentation The comment identifies project and missing-input proof responsibilities; Dirent retains kind information.
   * @evidence contracts/portability.md#os-neutral-implementation OS-neutral directory entries retain observed names and native kinds; case comparison follows the owning directory's policy in the consumer.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of readdir is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of readdir is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of readdir is declared here; the cost belongs to its
   *   implementation.
   */
  readdir(location: string): fs.Dirent[];

  /**
   * Resolve one lexical path to its current physical target.
   *
   * @evidence contracts/common.md#principled-implementation Physical target resolution distinguishes changed link selection from unchanged lexical spelling and content.
   * @evidence contracts/common.md#clear-and-simple-design One string observation exposes the resolver capability while equivalence and failure handling remain in proof consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Physical identity is observed rather than fabricated by removing link-like path components.
   * @evidence contracts/common.md#meaningful-documentation The native comment distinguishes lexical input from the current physical target.
   * @evidence contracts/portability.md#os-neutral-implementation OS-neutral resolution follows the actual filesystem's symlinks, junctions, and native aliases instead of a universal lowercase rule.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of realpath is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of realpath is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of realpath is declared here; the cost belongs to its
   *   implementation.
   */
  realpath(location: string): string;

  /**
   * Read ordinary metadata for file-kind and missing-path checks.
   *
   * @evidence contracts/common.md#principled-implementation Ordinary following stats classify the observed target separately from lstat topology and exact content signatures.
   * @evidence contracts/common.md#clear-and-simple-design The conventional Stats capability serves classification without demanding bigint arithmetic from every consumer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts File kind is not guessed from extension or substituted for evidence of readable bytes.
   * @evidence contracts/common.md#meaningful-documentation The comment names the classification responsibility and distinguishes it from nanosecond statBigInt.
   * @evidence contracts/portability.md#os-neutral-implementation OS-neutral kind checks follow native observations in the supplied view rather than assumed directory or link behavior.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of stat is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of stat is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of stat is declared here; the cost belongs to its
   *   implementation.
   */
  stat(location: string): fs.Stats;

  /**
   * Read nanosecond metadata for stable file and directory signatures.
   *
   * @evidence contracts/common.md#principled-implementation Bigint metadata preserves reporting-device and exact stamp information required by signature separability proofs.
   * @evidence contracts/common.md#clear-and-simple-design The precision-specific capability remains separate from ordinary classification stats.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Native precision cannot be reconstructed from rounded millisecond values or a process-clock guess.
   * @evidence contracts/common.md#meaningful-documentation The comment links nanosecond observations to file and directory signatures, explaining this separate method.
   * @evidence contracts/portability.md#os-neutral-implementation OS-neutral signatures use the observed filesystem's device and bigint stamps, with clock-proof consumers handling granularity and cross-volume limits.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of statBigInt is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of statBigInt is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of statBigInt is declared here; the cost belongs to
   *   its implementation.
   */
  statBigInt(location: string): fs.BigIntStats;

  /** Override path parsing when the observed filesystem is not the host. */
  platform?: NodeJS.Platform;

  /**
   * Open one directory's change notification, or throw when the observed
   * filesystem cannot provide one.
   *
   * Left undefined, generations watch the host filesystem: in process on Linux,
   * and through an isolated broker process on Windows and macOS. An embedder
   * observing another filesystem supplies its own; a generation whose watch
   * cannot be opened keeps validating from recorded state instead of losing its
   * cache.
   *
   * Supplying one replaces the broker as well, so an embedder that wraps Node's
   * own `fs.watch` gives up what the broker provides: on Windows, containing
   * the native abort Node's fs-event backend can raise when a watched temporary
   * tree is deleted, and on macOS, one FSEventStream per watch whose dropped
   * events are reported rather than lost silently.
   *
   * @evidence contracts/common.md#principled-implementation The watch capability reports actual directory changes and failure; its absence or failure cannot certify silence as unchanged inputs.
   * @evidence contracts/common.md#clear-and-simple-design One optional native operation exposes observation and a close handle, leaving broker selection and retained-generation proof in their owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Injected watches are explicit capabilities rather than patched fs methods, and errors require recorded-state validation instead of synthetic live coverage.
   * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain absent overrides, failed watches, broker bypass, and the Windows/macOS capability lost when wrapping fs.watch directly.
   * @evidence contracts/portability.md#os-neutral-implementation OS-neutral watching requires the observed filesystem's capability and accounts for backend-specific abort isolation and dropped-stream reporting rather than assuming recursive notifications are interchangeable.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of watch is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of watch is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of watch is declared here; the cost belongs to its
   *   implementation.
   */
  watch?(
    directory: string,
    listener: (eventType: string, filename: string | null) => void,
    onError: () => void,
    recursive?: boolean,
  ): { close: () => void };
}
