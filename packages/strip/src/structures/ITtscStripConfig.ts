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
 * @evidence contracts/common.md#standard-implementation-practices This exported TypeScript interface follows the dedicated typed-config convention used by banner and the strip README. The calls and statements lists express consumer-selected native syntax removal, with defaults only when both keys are omitted; generated declarations replace handwritten export-assignment types. The whole type is data-only, with no foreign mutation, fixture branch, test-only behavior or alternate runtime implementation.
 * @evidence contracts/common.md#portable-behavior The lists name TypeScript syntax, not filesystem locations or commands. Their matching contract contains no path separators, case normalization, process calls or OS-specific state.
 * @evidence contracts/common.md#meaningful-documentation Interface and member JSDoc distinguish both-key defaults from one-key replacement, explain exact and deeper prefix matching and its negative boundary, identify rejected shapes and debugger-only statements, and warn that whole-statement removal deletes argument evaluation. Separate native paragraphs follow the documentation skill's clear prose and rationale guidance; field documentation remains alongside the fields while the type owns the checklist answer.
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
