import path from "node:path";

/**
 * The file candidates ttsc tries for an `extends` specifier recognized as
 * host-absolute or dot-relative, or `undefined` for module selection.
 *
 * TypeScript-Go's `getExtendsConfigPath` first folds every `\` of the specifier
 * into `/`. A rooted specifier, or one starting with `./` or `../`, then names
 * a file below the declaring config's directory, kept under the spelling it was
 * reached by: the file itself, and, unless it already ends in `.json`, the file
 * with `.json` appended. A directory is never expanded to its `tsconfig.json`.
 * Every other specifier is resolved like a module (`resolveTsconfigExtends`). A
 * bare `.` or `..` is taken as a file path too, as ttsc's readers treat it.
 * Classification and normalization here use the host's native path API;
 * TypeScript-Go's host-independent DOS-root recognition is not reproduced for
 * foreign drive spellings or a bare drive such as `C:`.
 *
 * A reader that records what an `extends` it could not resolve would take to
 * appear, as `@ttsc/unplugin` does to observe a missing base config, asks this
 * rather than repeating the rule.
 *
 * @param tsconfig The declaring config, as the reader named it.
 * @param specifier The `extends` value as written.
 *
 * @returns Ordered native candidates, or undefined when this reader delegates
 *   the normalized specifier to module resolution.
 *
 * @evidence contracts/common.md#principled-implementation Backslash normalization followed by host-absolute/dot-relative classification uses the compiler's exact-then-json candidate order for those paths; bare dot spellings retain the existing reader extension, and native root classification is not universal compiler DOS-root parity.
 * @evidence contracts/common.md#clear-and-simple-design This helper constructs candidates without reading them or resolving packages, so both readers share the spelling rule while retaining their own observation and selection responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The dot-relative prefixes and json suffix express config grammar rather than named consumers or fixtures; no directory-to-tsconfig guess is inserted.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain candidate order, lexical anchoring, module classification and the deliberate bare-dot extension; params state whose spelling is retained.
 * @evidence contracts/portability.md#os-neutral-implementation Compiler-style slash normalization precedes host-native isAbsolute/dirname/resolve operations; no realpath or case folding discards the lexical anchor needed for relative extends.
 * @evidence contracts/performance.md#efficient-algorithms Normalization scans the specifier and native dirname/resolve process path text; at most two output strings are constructed, but their bytes are not bounded by the array length. No filesystem candidates are read here.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns caller-owned path strings and an array, with no independent handle, task or historical retention.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This candidate adapter owns no coordinated config lifecycle or cache; relative declaring paths also depend on the native current-directory resolution context.
 */
export function tsconfigExtendsFileCandidates(
  tsconfig: string,
  specifier: string,
): string[] | undefined {
  const normalized = specifier.replaceAll("\\", "/");
  if (
    !path.isAbsolute(normalized) &&
    normalized !== "." &&
    normalized !== ".." &&
    !normalized.startsWith("./") &&
    !normalized.startsWith("../")
  ) {
    return undefined;
  }
  const location = path.resolve(path.dirname(tsconfig), normalized);
  return location.endsWith(".json")
    ? [location]
    : [location, `${location}.json`];
}
