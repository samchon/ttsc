import path from "node:path";

/**
 * The exact files TypeScript-Go tries for an `extends` specifier that names a
 * file, in order, or `undefined` for one it resolves as a module.
 *
 * TypeScript-Go's `getExtendsConfigPath` first folds every `\` of the specifier
 * into `/`. A rooted specifier, or one starting with `./` or `../`, then names
 * a file below the declaring config's directory, kept under the spelling it was
 * reached by: the file itself, and, unless it already ends in `.json`, the file
 * with `.json` appended. A directory is never expanded to its `tsconfig.json`.
 * Every other specifier is resolved like a module (`resolveTsconfigExtends`). A
 * bare `.` or `..` is taken as a file path too, as ttsc's readers always did.
 *
 * A reader that records what an `extends` it could not resolve would take to
 * appear, as `@ttsc/unplugin` does to observe a missing base config, asks this
 * rather than repeating the rule (samchon/ttsc#1489).
 *
 * @param tsconfig The declaring config, as the reader named it.
 * @param specifier The `extends` value as written.
 *
 * @evidence contracts/common.md#principled-implementation Backslash normalization followed by rooted/dot-relative classification reproduces the compiler's file-candidate order; bare dot spellings explicitly retain the existing reader extension.
 * @evidence contracts/common.md#clear-and-simple-design This helper constructs candidates without reading them or resolving packages, so both readers share the spelling rule while retaining their own observation and selection responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The dot-relative prefixes and json suffix express config grammar rather than named consumers or fixtures; no directory-to-tsconfig guess is inserted.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain candidate order, lexical anchoring, module classification and the deliberate bare-dot extension; params state whose spelling is retained.
 * @evidence contracts/portability.md#os-neutral-implementation Compiler-style slash normalization precedes host-native isAbsolute/dirname/resolve operations; no realpath or case folding discards the lexical anchor needed for relative extends.
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
