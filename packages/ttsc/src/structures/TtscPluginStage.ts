/**
 * Pipeline stage where a plugin's lazily built Go sidecar participates.
 *
 * - `"transform"`: owns the TypeScript-Go emit pass. This is the default.
 * - `"check"`: runs before emit and reports diagnostics only.
 * - `"output"`: runs after emit for each emitted JS/d.ts file.
 */
export type TtscPluginStage = "transform" | "check" | "output";
