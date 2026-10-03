import fs from "node:fs";

/**
 * Filesystem predicates the runtime hooks and the dependency lock share.
 *
 * Missing-component errno classification and followed regular-file stat share
 * one meaning across lock recovery and the serve lanes. A code-shaped caller
 * value is not authenticated native evidence, and file kind is not proof of
 * readable contents or a pinned path identity.
 *
 * @evidence contracts/common.md#principled-implementation Missing-component code classification and followed regular-file stat are distinct predicates; they do not authenticate arbitrary error-shaped inputs or certify readable contents.
 * @evidence contracts/common.md#clear-and-simple-design One small namespace shares the two filesystem predicates without retaining an alternate filesystem model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Predicates use documented Node fs and errno semantics; no consumer-specific path or foreign API replacement determines the answer.
 * @evidence contracts/common.md#meaningful-documentation The namespace describes the common decision boundary and each function documents its own missing-path or regular-file meaning.
 * @evidence contracts/portability.md#os-neutral-implementation Node's native stat and portable ENOENT/ENOTDIR error codes establish file type and absence without guessing from the host OS name.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace groups predicates and does not independently choose a computation strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace retains no query cache or in-flight computation; each predicate inspects its current argument.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace owns no retained state, handle or task.
 */
export namespace RuntimeFilesystem {
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
