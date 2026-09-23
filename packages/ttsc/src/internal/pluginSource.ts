/**
 * Public entry of `ttsc/plugin-source`.
 *
 * A plugin's binary is keyed on its Go source, and a transform envelope reports
 * the state of every source directory its binaries were built from
 * (`ITtscCompilerTransformation.ISuccess.pluginSources`). A consumer that
 * caches the output, as `@ttsc/unplugin` does, proves that state with the rule
 * the build itself applied rather than a copy of it (samchon/ttsc#1487): the
 * digest of a source directory, and which of its subdirectories the digest
 * passes over. This barrel is the one module path such a consumer imports, so
 * the implementation keeps one declaration per file.
 */
export * from "../plugin/internal/source/pluginSourceDigest";
export * from "../plugin/internal/source/prunesPluginSourceDirectory";
