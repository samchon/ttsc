/**
 * Pipeline stage where a plugin's lazily built Go sidecar participates.
 *
 * - `"transform"`: participates in the TypeScript-Go transform path. Transform
 *   plugins do not receive emitted JavaScript or emitted file text.
 * - `"check"`: runs before emit and reports diagnostics only. Use this for lint
 *   or validation plugins that should fail the compile before JavaScript or
 *   declaration output is generated.
 */
export type TtscPluginStage = "transform" | "check";
