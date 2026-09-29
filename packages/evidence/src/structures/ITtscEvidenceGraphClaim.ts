import type { ITtscEvidenceGraphMarkdownClaim } from "./ITtscEvidenceGraphMarkdownClaim";
import type { ITtscEvidenceGraphPrismaClaim } from "./ITtscEvidenceGraphPrismaClaim";
import type { ITtscEvidenceGraphTypeScriptClaim } from "./ITtscEvidenceGraphTypeScriptClaim";

/**
 * One population of artifacts asserting that it implements, verifies, or
 * documents its referenced evidence.
 *
 * A claim owns the outgoing side of every evidence edge it declares: its files
 * host the `@evidence` citations, and each referenced evidence population must
 * be acknowledged completely. Separate claims remain separate obligations,
 * preventing two teams' partial use of the same evidence from being reported as
 * one complete use.
 *
 * @evidence contracts/common.md#principled-implementation The discriminated union includes exactly the three artifact kinds that can host acknowledgments; Swagger operations remain reference-only.
 * @evidence contracts/common.md#clear-and-simple-design Each artifact-specific interface owns its selector while the common base owns outgoing coverage, so callers narrow one type discriminator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The alternatives describe supported artifact semantics and contain no consumer-specific variant or test-only escape.
 * @evidence contracts/common.md#meaningful-documentation The JSDoc explains the outgoing relationship and independent obligations rather than repeating the union members, with prose separated from tags.
 */
export type ITtscEvidenceGraphClaim =
  | ITtscEvidenceGraphMarkdownClaim
  | ITtscEvidenceGraphPrismaClaim
  | ITtscEvidenceGraphTypeScriptClaim;
