/**
 * Match TypeScript's platform-independent treatment of config separators.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Backslashes become config-language forward slashes before native resolution,
 *   matching compiler parsing instead of treating them as POSIX literal names.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns config separator spelling, separate from native path identity.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Normalization is a compiler syntax rule rather than an OS-specific filename
 *   repair or a branch for a known configuration.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native description identifies config-language semantics, which explains
 *   why the function is distinct from an arbitrary filesystem path conversion.
 * @evidence contracts/portability.md#os-neutral-implementation Backslashes become slashes as TypeScript's configuration language treats them before native resolution; a path handed to the filesystem is resolved natively by the callers and never rewritten here.
 */
export function normalizeTypeScriptPathSeparators(target: string): string {
  return target.replace(/\\/g, "/");
}
