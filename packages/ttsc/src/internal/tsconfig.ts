/**
 * Public entry of `ttsc/tsconfig`.
 *
 * How a `tsconfig.json` is read is decided once, in ttsc: the JSONC grammar,
 * the resolution of an `extends` specifier by TypeScript-Go's rule, and whether
 * a plugin entry's path is relative, as ttsc's plugin loader reads it.
 * `@ttsc/unplugin` reads the same configs to build its membership policy, its
 * alias overlay, and the snapshot of the config chain, and used to carry its
 * own copy of each of these rules (samchon/ttsc#1489). This barrel is the one
 * module path such a reader imports, so the implementation keeps one
 * declaration per file.
 */
export * from "../compiler/internal/project/parseJsonc";
export * from "../compiler/internal/project/resolveTsconfigExtends";
export * from "../compiler/internal/project/tsconfigExtendsFileCandidates";
export * from "../plugin/internal/load/isRelativePluginSpecifier";
