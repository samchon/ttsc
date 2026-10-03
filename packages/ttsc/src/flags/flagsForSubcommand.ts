import type { AnySubcommand } from "./AnySubcommand";
import { FLAG_SCHEMA } from "./FLAG_SCHEMA";
import type { FlagSpec } from "./FlagSpec";

/**
 * Return schema rows declared for the command, in schema order. Rows retain
 * their aliases and consumer ownership; this function does not restrict the
 * result to flags consumed by the JavaScript launcher.
 *
 * @evidence contracts/common.md#principled-implementation Array filtering selects exactly rows whose subcommands include the requested identity, preserving the schema order and original row objects.
 * @evidence contracts/common.md#clear-and-simple-design This function owns command membership alone; parseFlags separately applies launcher ownership and expands aliases for token lookup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Membership comes from FlagSpec rather than separate command-specific option lists that could drift from forwarding policy.
 * @evidence contracts/common.md#meaningful-documentation The native comment correctly describes schema rows rather than tokens and explains the consumer-selection boundary, applying the documentation skill's precise responsibility guidance.
 * @evidence contracts/performance.md#efficient-algorithms Filtering F fixed schema rows checks each row's small command list and allocates only matching rows. The scan preserves declaration order, and parseFlags reuses its derived acceptance index rather than repeating this scan for every invocation.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This selector returns an independent mutable array and owns no request coordinator; parseFlags owns reuse of the derived immutable acceptance index.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Matching row references are returned to the caller in a fresh array; no historical result or external resource is retained by this selector.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation flagsForSubcommand computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
 */
export function flagsForSubcommand(subcommand: AnySubcommand): FlagSpec[] {
  return FLAG_SCHEMA.filter((flag) => flag.subcommands.includes(subcommand));
}
