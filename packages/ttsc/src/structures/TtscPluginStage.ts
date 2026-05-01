/**
 * Pipeline stage where a plugin's lazily built Go sidecar participates.
 *
 * - `"transform"`: owns the TypeScript transform/emit pass. This is the
 *   default and is the right stage for compiler-transform plugins such as
 *   typia-style source rewrites. During compilation, a transform sidecar
 *   produces the project's emitted output. During
 *   {@link TtscCompiler.transform}, the same sidecar may expose a
 *   source-to-source `transform` command that returns transformed TypeScript
 *   text.
 * - `"check"`: runs before emit and reports diagnostics only. Use this for
 *   lint or validation plugins that should fail the compile before JavaScript
 *   or declaration output is generated.
 * - `"output"`: runs after emit for each emitted output file. Use this for
 *   post-processing plugins such as banner insertion, import-path rewriting,
 *   or output stripping that operate on `.js`, `.d.ts`, or map files.
 */
export type TtscPluginStage = "transform" | "check" | "output";
