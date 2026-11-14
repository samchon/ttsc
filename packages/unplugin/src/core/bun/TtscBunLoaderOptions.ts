import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * Options of the Bun loader: the shared adapter options plus `filter`, which
 * chooses the modules to transform.
 *
 * `Bun.plugin()` and a `bunfig.toml` preload have no include or exclude rules
 * of their own, so the loader takes that choice itself. The shared options stay
 * free of a member the other adapters would ignore.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Bun's own `onLoad` selects modules with a RegExp, so one pattern
 *   or a list of alternatives expresses the choice, and patterns only narrow
 *   the modules the loader already includes.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The member sits on the adapter that honors it, and the shared options
 *   type is unchanged, so no other adapter accepts and ignores a filter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The member selects modules by path pattern for every consumer. It names
 *   no fixture or consumer and compensates for no defect.
 * @evidence contracts/common.md#meaningful-documentation
 *   The member comment states, each as its own paragraph, the skipped-module
 *   behavior, the empty-list meaning and narrowing, the matched path spelling,
 *   the case policy and flag behavior, and the option-lock effect, and shows
 *   one example.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Patterns are tested against a separator-normalized spelling,
 *   which is matching syntax and not filesystem identity.
 *   The type learns no platform capability and sets no case policy.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The interface declares a shape and performs no computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The interface declares a shape and has no work to reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The interface declares a shape and holds no handle or state.
 */
export interface TtscBunLoaderOptions extends TtscUnpluginOptions {
  /**
   * Restricts ttsc to the modules whose absolute path matches a pattern.
   *
   * A module that no pattern matches is skipped: Bun loads it as it would
   * without ttsc, so no ttsc plugin runs on it.
   *
   * Omitting the member or passing an empty array applies no restriction. A
   * pattern only narrows what ttsc already transforms: `node_modules`,
   * declaration files and entries supplied through `Bun.build({ files })` stay
   * with Bun whether or not a pattern matches them.
   *
   * A pattern is tested against the absolute path, such as
   * `/home/me/app/src/validators/email.ts`, and not against an import
   * specifier. The path is tested with each `\` written as `/`, so a pattern
   * written with `/` behaves the same on every OS. A Windows path starts with
   * its drive, as in `C:/app/src/validators/email.ts`, so match part of the
   * path and do not anchor on a leading `/`.
   *
   * Matching is case-sensitive, so add the `i` flag on a case-insensitive
   * filesystem. The `g` and `y` flags are safe to use, since no state carries
   * from one module to the next.
   *
   * Under `register`, the first TypeScript module outside `node_modules` that
   * loads locks the options, `filter` included, even if no pattern matches that
   * module. A later call with different options throws.
   *
   * @example
   *   // Transform the modules in src/validators and the *.schema.ts files.
   *   register({ filter: [/\/src\/validators\//, /\.schema\.ts$/] });
   */
  filter?: RegExp | readonly RegExp[];
}
