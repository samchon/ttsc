/**
 * Whether a plugin specifier of a `tsconfig.json` plugin entry is a relative
 * path, including the Windows backslash spellings a user may write there.
 *
 * A relative `transform` resolves from the config that wrote it, where a bare
 * package specifier resolves from the project root (`ProjectPluginEntries`).
 * `@ttsc/unplugin` asks the same question, through the `ttsc/tsconfig` entry,
 * of every path-valued key of a plugin entry it re-states in a wrapper config
 * it writes outside the project, so a value the compiler would resolve from the
 * project keeps that meaning there.
 *
 * @param specifier The value as written in the config.
 *
 * @evidence contracts/common.md#principled-implementation Dot/dot-dot and their slash/backslash prefixes distinguish explicit relative paths from package specifiers, preserving the declaring-config base for those values.
 * @evidence contracts/common.md#clear-and-simple-design A shared lexical predicate gives wrapper rewriting and loader selection the same relative-specifier classification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Both separator spellings are actual supported config inputs; no package-name exception is used to choose a resolution base.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains the declaring-config versus project base and the wrapper consumer, with paragraphs and tag separation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The explicit slash and Windows backslash spellings support OS-neutral classification; this operation detects relative syntax without pretending to canonicalize or compare physical paths.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isRelativePluginSpecifier acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidence contracts/performance.md#efficient-algorithms Two exact short-name checks and four fixed-width prefix checks inspect only the relative markers, with no suffix scan, normalization or result-string allocation; work is bounded by these marker widths rather than the full specifier length.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This lexical boolean observation coordinates no expensive producer or retained equivalent-answer state; it neither resolves the specifier nor caches mutable package or filesystem authority.
 */
export function isRelativePluginSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}
