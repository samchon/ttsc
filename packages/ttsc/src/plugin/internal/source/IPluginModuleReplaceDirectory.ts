/**
 * One `replace` directive of a plugin module's `go.mod` whose target is a local
 * directory outside the module (`pluginModuleReplaceDirectories`).
 *
 * `go build` in the original module compiles that directory in place, so ttsc
 * keys and snapshots it, reports its state, and resolves a relative spelling
 * from the module's own directory (samchon/ttsc#1506).
 *
 * @evidence contracts/common.md#principled-implementation Logical module/version identity, original spelling and resolved directory preserve the distinction needed to hash sources and rewrite the correct Go replacement directive.
 * @evidence contracts/common.md#clear-and-simple-design One replacement record travels from Go's directive reader to keying and scratch anchoring without reparsing its text.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Module replacements are actual go.mod directives read by Go's editor, not guessed dependencies or consumer-specific overrides.
 * @evidence contracts/common.md#meaningful-documentation Members distinguish resolved target, original spelling, left-side module identity and optional version, with separated comments.
 * @evidence contracts/portability.md#os-neutral-implementation Directory is a physical absolute native path while spelled preserves modfile syntax; modulePath remains a Go identifier rather than a filesystem path.
 */
export interface IPluginModuleReplaceDirectory {
  /** The target's absolute path. */
  directory: string;

  /** The replaced module path, the directive's left side. */
  modulePath: string;

  /** The target as `go.mod` spells it. */
  spelled: string;

  /** The replaced version, when the directive names one. */
  version?: string;
}
