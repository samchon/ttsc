/**
 * Configure intentional statement removal in a standalone strip.config file.
 *
 * Omitting both keys selects calls `console.log`, `console.debug`, `assert.*`
 * and statement `debugger`. Supplying either key replaces both default lists;
 * an omitted counterpart or an empty array removes nothing in that category.
 * The native loader requires an object and validates each configured pattern.
 *
 * Stripping deletes the whole statement, including argument evaluation. Use
 * this only for calls whose removal is intended to change runtime behavior.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional readonly lists represent omission separately from an empty
 *   removal list. The native parser applies defaults only when both keys are
 *   absent and validates syntax that TypeScript string types cannot constrain.
 *   The representation intentionally permits input construction while runtime
 *   validation rejects unsupported dotted patterns and statement names.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Two independent lists group call patterns and statement kinds by the
 *   parser responsibility they configure. Filesystem discovery remains a host
 *   entry concern instead of becoming another strip behavior option.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The whole type is data-only, with no foreign mutation, fixture branch,
 *   test-only behavior or alternate runtime implementation.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   These lists identify TypeScript statement syntax to remove. They define
 *   no native filesystem, path-identity or process boundary.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   This schema carries consumer choices and performs no computation.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The schema does not coordinate config evaluation or AST transformations.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   These value lists do not own the compiler or loader's resource lifetime.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Interface and member JSDoc distinguish both-key defaults from one-key
 *   replacement, explain exact and deeper prefix matching and its negative
 *   boundary, identify rejected shapes and debugger-only statements, and warn
 *   that whole-statement removal deletes argument evaluation. Separate native
 *   paragraphs follow the documentation skill's clear prose and rationale
 *   guidance; field documentation remains alongside the fields while the type
 *   owns the checklist answer.
 */
export interface ITtscStripConfig {
  /**
   * Dotted callee patterns for whole call-expression statements to remove.
   *
   * An exact name matches that dotted identifier chain. A trailing `.*`
   * matches one or more further property segments, so `assert.*` includes
   * `assert.equal()` and `assert.strict.equal()` but excludes `assert()`.
   * Computed access and calls embedded in other expressions remain untouched.
   * Empty or whitespace-only entries, empty dotted segments and nonfinal `*`
   * segments are rejected. A matched statement's arguments are also removed.
   */
  calls?: readonly string[];

  /**
   * Bare statement kinds to remove; only `debugger` is supported.
   *
   * Other names and empty or whitespace-only entries are rejected. An omitted
   * list removes no statement kind when `calls` is supplied; omitting both
   * fields instead activates the interface's documented defaults.
   */
  statements?: readonly string[];
}
