

 // native lint subcommand (`packages/lint/linthost/*.go`)

/**
 * Argument shape of a flag.
 *
 * - `boolean` — `--flag` with an optional spaced `true` / `false`. Launcher flags
 *   also accept `--flag=true` / `--flag=false`; tsgo-forwarded flags stay
 *   verbatim because pinned tsgo does not split `=`.
 * - `value` — `--flag value`. Launcher flags also accept `--flag=value`.
 * - `valueOptional` — `--flag` standalone is allowed; if followed by a non-flag
 *   token that token is consumed as the value. (Currently unused — declared for
 *   future flags like `--watch [path]`.)
 */
export type FlagKind = "boolean" | "value" | "valueOptional";
