// The published `lib/core/options` subpath resolves for a Node10 consumer only
// as a file. As `options/index`, the package's `typesVersions` catch-all
// remaps the directory's `index` to `lib/index`, so this barrel sits beside
// the directory rather than inside it.
export type { ResolvedTtscUnpluginOptions } from "./options/ResolvedTtscUnpluginOptions";
export { resolveOptions } from "./options/resolveOptions";
export type { TtscUnpluginCompilerOptionsJson } from "./options/TtscUnpluginCompilerOptionsJson";
export type { TtscUnpluginOptions } from "./options/TtscUnpluginOptions";
