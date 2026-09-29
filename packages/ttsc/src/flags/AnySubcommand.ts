import type { TtscSubcommand } from "./TtscSubcommand";
import type { TtsxSubcommand } from "./TtsxSubcommand";

/**
 * Every command surface a flag can be scoped to: each `ttsc` subcommand and the
 * `ttsx` runner.
 *
 * @evidence contracts/common.md#principled-implementation The union admits exactly the command identities declared by the two CLI dispatchers; shared flag consumers can accept either surface without treating arbitrary strings as commands.
 * @evidence contracts/common.md#clear-and-simple-design This alias combines the existing command vocabularies rather than maintaining a third list that could drift from their dispatchers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The accepted literals describe actual CLI surfaces, with no consumer-specific command exceptions.
 * @evidence contracts/common.md#meaningful-documentation The native comment names both contributing command surfaces; its concise paragraph follows the documentation skill and requires no separate member explanation for a union alias.
 */
export type AnySubcommand = TtscSubcommand | TtsxSubcommand;
