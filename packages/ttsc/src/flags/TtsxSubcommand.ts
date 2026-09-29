/**
 * The runner command identity used to select its accepted flag rows.
 *
 * @evidence contracts/common.md#principled-implementation The sole literal matches the current runner dispatcher and keeps runner-only flags distinct from compiler commands.
 * @evidence contracts/common.md#clear-and-simple-design The alias supplies the identity required by the shared flag schema without implementing speculative runner subcommands.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed ttsx spelling is the public command contract used by the parser's callers.
 * @evidence contracts/common.md#meaningful-documentation The comment states the identity's selection role instead of promising future features, following the documentation skill's direct purpose-oriented prose.
 */
export type TtsxSubcommand = "ttsx";
