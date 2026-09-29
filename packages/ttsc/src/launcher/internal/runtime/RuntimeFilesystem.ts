import fs from "node:fs";

/**
 * Filesystem predicates the runtime hooks and the dependency lock share.
 *
 * They answer the same questions for every caller, so "missing" and "occupied"
 * mean one thing across the lock protocol and the serve lanes.
 *
 * @evidence contracts/common.md#principled-implementation Native errno absence and a followed regular-file stat are distinct predicates, so lock recovery and serve decisions do not confuse an unreadable path with a usable file.
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
   * Whether an error means the path, or one of its parents, does not exist.
   * Non-error values and unrelated codes return false.
   *
   * @evidence contracts/common.md#principled-implementation Only ENOENT and ENOTDIR establish a missing path component; an unknown value, permission error or other errno supplies no such evidence.
   * @evidence contracts/common.md#clear-and-simple-design One total code predicate keeps missing-path classification identical across its callers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No broad exception-to-absence fallback or expected path name replaces the documented errno distinction.
   * @evidence contracts/common.md#meaningful-documentation Native prose states what absence means and how unknown values are classified, separated from checklist tags.
   * @evidence contracts/portability.md#os-neutral-implementation Node's documented errno codes represent native absence across hosts without inspecting platform-specific error message text.
   * @evidence contracts/performance.md#efficient-algorithms The predicate inspects one code and two fixed comparisons in O(1) time and space.
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
   * @evidence contracts/common.md#principled-implementation Native stat follows links and its regular-file predicate excludes directories and special files; a failed stat cannot establish a usable regular file.
   * @evidence contracts/common.md#clear-and-simple-design A single fs query and boolean failure boundary make the serve predicate independent of lock-error classification.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The answer comes from the actual filesystem type rather than filename extension or fixture path.
   * @evidence contracts/common.md#meaningful-documentation The native comment explains link following and failed-stat behavior so callers know false does not distinguish missing from denied access.
   * @evidence contracts/portability.md#os-neutral-implementation fs.statSync exposes the native file type and link behavior; native spelling is preserved without separator or case rewriting.
   * @evidence contracts/performance.md#efficient-algorithms One stat answers the predicate without a parent-directory listing or content read.
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
