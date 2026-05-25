/**
 * Pipeline stage where a plugin's lazily built Go source participates.
 *
 * - `"transform"`: participates in the TypeScript-Go transform path. Transform
 *   plugins do not receive emitted JavaScript or emitted file text.
 * - `"check"`: runs before emit and reports diagnostics. Use this for lint or
 *   validation plugins that should fail the compile before JavaScript or
 *   declaration output is generated. Check plugins may also implement `fix` and
 *   `format` commands, which `ttsc fix` / `ttsc format` invoke with emit
 *   disabled.
 */
export type TtscPluginStage = "transform" | "check";
