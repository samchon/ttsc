/**
 * Public entry of `ttsc/plugin-source`.
 *
 * A plugin's binary is keyed on its Go source and the environment it is built
 * in, and a transform envelope reports the state of every source directory its
 * binaries were built from
 * (`ITtscCompilerTransformation.ISuccess.pluginSources`). A consumer that
 * caches the output, as `@ttsc/unplugin` does, proves that state with the rule
 * the build itself applied rather than a copy of it (samchon/ttsc#1487,
 * samchon/ttsc#1493): the state of a source directory, the files and digest of
 * its sources within that state, which of its subdirectories the state passes
 * over, and the ttsc and TypeScript-Go versions every build is keyed on, which
 * name output kept beyond the process that produced it (samchon/ttsc#1483).
 * This barrel is the one module path such a consumer imports, so the
 * implementation keeps one declaration per file.
 */
export * from "../plugin/internal/source/collectPluginSourceFiles";
export * from "../plugin/internal/source/pluginBuildVersions";
export * from "../plugin/internal/source/pluginSourceDigest";
export * from "../plugin/internal/source/pluginSourceState";
export * from "../plugin/internal/source/pluginSourceStateHolds";
export * from "../plugin/internal/source/prunesPluginSourceDirectory";
