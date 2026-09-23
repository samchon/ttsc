/**
 * Whether a plugin specifier of a `tsconfig.json` plugin entry is a relative
 * path, including the Windows backslash spellings a user may write there.
 *
 * A relative `transform` resolves from the config that wrote it, where a bare
 * package specifier resolves from the project root (`ProjectPluginEntries`).
 * `@ttsc/unplugin` asks the same question, through the `ttsc/tsconfig` entry,
 * of every path-valued key of a plugin entry it re-states in a wrapper config
 * it writes outside the project, so a value the compiler would resolve from
 * the project keeps that meaning there (samchon/ttsc#1489).
 *
 * @param specifier The value as written in the config.
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
