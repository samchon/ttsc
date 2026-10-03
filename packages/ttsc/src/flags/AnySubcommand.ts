import type { TtscSubcommand } from "./TtscSubcommand";
import type { TtsxSubcommand } from "./TtsxSubcommand";

/**
 * Flag-schema command identities: compiler command lanes and the `ttsx` runner.
 * This is not an inventory of every dispatcher word: direct `help`/`version`
 * dispatch and nested cache commands do not introduce flag-selection identities.
 *
 * @evidence contracts/common.md#principled-implementation The union admits the two maintained flag-selection vocabularies; shared schema consumers can select either surface without admitting arbitrary dispatcher words as flag contexts.
 * @evidence contracts/common.md#clear-and-simple-design This alias combines the existing command vocabularies rather than maintaining a third list that could drift from their dispatchers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The accepted literals describe actual CLI surfaces, with no consumer-specific command exceptions.
 * @evidence contracts/common.md#meaningful-documentation The native comment names both contributing command surfaces; its concise paragraph follows the documentation skill and requires no separate member explanation for a union alias.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type AnySubcommand = TtscSubcommand | TtsxSubcommand;
