import type { TtscSubcommand } from "./TtscSubcommand";
import type { TtsxSubcommand } from "./TtsxSubcommand";

/**
 * Every command surface a flag can be scoped to: each `ttsc` subcommand and the
 * `ttsx` runner.
 */
export type AnySubcommand = TtscSubcommand | TtsxSubcommand;
