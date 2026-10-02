import type { TtscEvidenceGraphMarkdownSymbol } from "./TtscEvidenceGraphMarkdownSymbol";
import type { ITtscEvidenceGraphClaimBase } from "./ITtscEvidenceGraphClaimBase";

/**
 * A population of Markdown documents claiming its referenced evidence.
 *
 * Markdown uses HTML comments as invisible but reviewable declaration hosts.
 * Both `@evidence <target> <reason>` and `@evidenceExclude <target> <reason>`
 * require a target and a non-empty explanation.
 *
 * An exclusion still has to appear in a selected claim file and on a selected
 * host kind. Its particular host is not part of the acknowledgement identity,
 * so moving it between eligible sections cannot change the target scope this
 * claim excludes. The target scope, not the declaration's host position,
 * determines which selected descendants are acknowledged.
 *
 * @example
 *   <!-- @evidence docs/orders.md#create-order This section adopts the creation contract. -->
 *
 * @evidence contracts/common.md#principled-implementation The Markdown discriminator and outline-kind selector express which parsed document scopes can make claims while coverage policy remains on their references.
 * @evidence contracts/common.md#clear-and-simple-design Only Markdown files and host kinds are specialized; the shared base remains responsible for roots, diagnostics and outgoing references.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The type selects outline kinds rather than hardcoding document names or accepting a fixture-specific acknowledgment path.
 * @evidence contracts/common.md#meaningful-documentation The comment describes where Markdown acknowledgments live and the member comments state file parsing and selector defaults, separated from these tags.
* @evidence contracts/portability.md#os-neutral-implementation The inherited stable root and ordered glob paths select a native document population independently of outline targets; separators are portable and identity remains the explicit graph policy rather than a guess from the OS name.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no algorithm and performs no computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration coordinates no computation across requests, so there is no result to share.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration owns no retained state, handle or running task.
 */
export interface ITtscEvidenceGraphMarkdownClaim extends ITtscEvidenceGraphClaimBase<"markdown"> {
  /**
   * Glob patterns for the Markdown files that must cite the referenced
   * evidence. Every matching regular file is parsed as Markdown regardless of
   * extension, so exclude non-Markdown assets rather than relying on a suffix.
   */
  files: string[];

  /**
   * Markdown node kind or kinds eligible to host this claim's declarations.
   *
   * Omit this property to select documents and H1 through H4 sections. A single
   * value selects one kind; a non-empty array selects the union of its kinds.
   *
   * A `"file"` declaration appears before the document's first ATX heading. A
   * heading declaration belongs to the nearest preceding ATX heading, whose
   * exact level must be selected. This makes an H3 declaration distinct from
   * its enclosing H2 section.
   *
   * @default ["file", "h1", "h2", "h3", "h4"]
   */
  symbol?: TtscEvidenceGraphMarkdownSymbol | TtscEvidenceGraphMarkdownSymbol[];
}
