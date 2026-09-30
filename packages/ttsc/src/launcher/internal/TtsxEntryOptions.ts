import path from "node:path";

import type { parseTtsxCLI } from "./parseTtsxCLI";

/**
 * Prepares Node entry options without invoking the compiler or host.
 *
 * @evidence contracts/common.md#principled-implementation Separate JavaScript build-option applicability from preload path classification; public launcher callers consume these exact results before starting native execution.
 * @evidence contracts/common.md#clear-and-simple-design One namespace groups two pure entry-boundary projections with one private lexical relative-path predicate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only supported launcher fields and native path APIs decide behavior; no consumer-specific preload, private Node method or fixture answer is substituted.
 * @evidence contracts/common.md#meaningful-documentation Native purpose and operation prose explain launcher/Node ownership and optional-value meaning, separated from acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.isAbsolute/path.resolve own filesystem spelling; bare and scoped package specifiers retain Node module-resolution ownership without manual case or slash rewriting.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups two concrete operations; their methods describe their own input processing.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This invocation-local projection coordinates no shared computation and retains no historical answer cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only call-local arrays or a returned path string exist; no process, directory, handle or task is acquired.
 */
export namespace TtsxEntryOptions {
  /**
   * Lists the options JavaScript entries cannot apply to an up-front TypeScript build.
   *
   * Values and program arguments are not options; their spelling remains intact.
   *
   * @evidence contracts/common.md#principled-implementation The parsed launcher fields name up-front build policy and forwarded tokens beginning with dash or at name compiler/response-file requests; JavaScript entries have no up-front program to apply them to.
   * @evidence contracts/common.md#clear-and-simple-design A fixed field projection followed by one forwarded-token filter preserves deterministic diagnostic order.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The result is the actual caller diagnostic input, not a second CLI parser or a test-only whitelist.
   * @evidence contracts/common.md#meaningful-documentation Native purpose and operation prose explain launcher/Node ownership and optional-value meaning, separated from acknowledgment tags.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This pure option record and token classification resolves no filesystem path and starts no process.
   * @evidence contracts/performance.md#efficient-algorithms Filtering T forwarded tokens is O(T) time and O(T) returned string references; the fixed launcher fields require bounded additional work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This invocation-local projection coordinates no shared computation and retains no historical answer cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only call-local arrays or a returned path string exist; no process, directory, handle or task is acquired.
   */
  export function unsupportedJavaScriptBuildOptions(parsed: Exclude<ReturnType<typeof parseTtsxCLI>, "help" | "version">): string[] {
    return [
    ...(parsed.project !== undefined ? ["--project"] : []),
    ...(parsed.cacheDir !== undefined ? ["--cache-dir"] : []),
    ...(parsed.checkers !== undefined ? ["--checkers"] : []),
    ...(parsed.noPlugins ? ["--no-plugins"] : []),
    ...(parsed.singleThreaded ? ["--singleThreaded"] : []),
    ...parsed.tsgoFlags.filter(
      (token) => token.startsWith("-") || token.startsWith("@"),
    ),
  ];
  }

  /**
   * Anchors file preloads to the invocation directory and leaves package names to Node.
   *
   * Relative file spellings and already absolute paths use native path resolution;
   * scoped and subpath package requests must not be anchored to the launcher install.
   *
   * @evidence contracts/common.md#principled-implementation Native absolute paths and explicit relative spellings denote files, while other requests remain module specifiers for Node resolution.
   * @evidence contracts/common.md#clear-and-simple-design One native absolute check and one lexical relative check precede path.resolve; package specifiers return unchanged.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign resolver is patched and no installed-package lookup or guessed extension changes the caller request.
   * @evidence contracts/common.md#meaningful-documentation Native purpose and operation prose explain launcher/Node ownership and optional-value meaning, separated from acknowledgment tags.
   * @evidence contracts/portability.md#os-neutral-implementation Native path.isAbsolute and path.resolve preserve host path semantics; explicit dot/slash or dot/backslash relative forms are classified without case folding or manual file URLs.
   * @evidence contracts/performance.md#efficient-algorithms Fixed prefix checks and one native path normalization cost O(P) path bytes with no filesystem traversal or per-package lookup.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This invocation-local projection coordinates no shared computation and retains no historical answer cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only call-local arrays or a returned path string exist; no process, directory, handle or task is acquired.
   */
  export function resolvePreload(cwd: string, preload: string): string {
  if (path.isAbsolute(preload) || isRelativeSpecifier(preload)) {
    return path.resolve(cwd, preload);
  }
  return preload;
}

  /** Explicit relative file spellings; bare package specifiers remain module requests. */
  function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}
}
