import { COMPILER_OPTION_ASCII_FOLDS } from "./COMPILER_OPTION_ASCII_FOLDS";

/**
 * Normalize a CLI token to the identity the compiler ttsc wraps resolves it by:
 * one or two leading dashes removed, the remainder lower-cased.
 *
 * The native compiler strips a `--` or `-` prefix and uses Unicode simple
 * lowercase mappings. Generated folds into its ASCII option-name domain
 * preserve mappings that JavaScript lowercase expands differently. Thus `--noEmit`,
 * `--noemit`, `--NOEMIT`, and `-noEmit` all name the same option to the tool
 * ttsc forwards to. Keying the index on the exact spelling would let a case
 * variant of a ttsc-owned flag fall through the unknown-flag escape hatch:
 * tsgo would honour it while every ttsc-side consumer of the same flag never
 * fired, with no diagnostic.
 *
 * This is the single normalization. Everything that resolves a token against
 * `FLAG_SCHEMA` — the parsing engine, the terminal / shadow / project-free
 * classifications, and the generated Go allow-lists — keys off this function,
 * so no two layers can disagree about which flag a spelling names.
 *
 * @evidence contracts/common.md#principled-implementation Removing at most two leading dashes and applying generated native Unicode folds before lowercase matches the verified ASCII option-name domain; generation rejects native or launcher names outside that domain. Callers separate an inline value before normalization because its case is data.
 * @evidence contracts/common.md#clear-and-simple-design The shared normalization function owns spelling identity for parsing, lookup and native allow-list derivation rather than duplicating that policy in each consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The regex expresses the supported dash grammar and preserves any further prefix characters; it does not recognize particular project arguments or alter the native option parser.
 * @evidence contracts/common.md#meaningful-documentation The comment explains accepted casing and dash variants plus the shared identity boundary, following the documentation skill's explanation-of-reasons guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a new string and retains nothing.
 * @evidence contracts/performance.md#efficient-algorithms Anchored prefix removal, a Unicode fold replacement and one lowercase pass process token text in linear time; non-ASCII characters use the module-built fold index rather than a scan of native declarations. Intermediate and returned strings grow with token length, and no invocation-specific index is rebuilt.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This invocation-local spelling transformation does not coordinate completed or in-flight work across requests; the generated native fold table is already shared by module identity.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation normalizeFlagToken computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
 */
export function normalizeFlagToken(token: string): string {
  return token
    .replace(/^--?/, "")
    .replace(/[^\x00-\x7f]/gu, (character) =>
      COMPILER_OPTION_ASCII_FOLDS.get(character) ?? character,
    )
    .toLowerCase();
}
