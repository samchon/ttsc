import type { ITtscEvidenceGraphMarkdownReference } from "./ITtscEvidenceGraphMarkdownReference";
import type { ITtscEvidenceGraphPrismaReference } from "./ITtscEvidenceGraphPrismaReference";
import type { ITtscEvidenceGraphSwaggerReference } from "./ITtscEvidenceGraphSwaggerReference";
import type { ITtscEvidenceGraphTypeScriptReference } from "./ITtscEvidenceGraphTypeScriptReference";

/**
 * One population of evidence units that a claim must cite completely.
 *
 * A reference selects what counts as evidence: Markdown documents and heading
 * sections, Prisma schema declarations, Swagger or OpenAPI operations, or
 * selected exported TypeScript symbols. Every unit it materializes must be
 * acknowledged by the owning claim, so a reference is the denominator of one
 * coverage obligation, never a pooled global set.
 *
 * @evidence contracts/common.md#principled-implementation The union permits each supported evidence artifact, including reference-only Swagger operations, and retains each kind's population contract.
 * @evidence contracts/common.md#clear-and-simple-design Artifact-specific interfaces share one policy base, keeping selection details with their parser rather than introducing a second configuration hierarchy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The closed alternatives reflect supported loaders rather than consumer names or fixture-specific bypasses.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains reference ownership and the coverage denominator; member-specific selection details remain in their respective declarations.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This union only selects among the artifact reference shapes and names no path, file, filesystem or process itself.
 */
export type ITtscEvidenceGraphReference =
  | ITtscEvidenceGraphMarkdownReference
  | ITtscEvidenceGraphPrismaReference
  | ITtscEvidenceGraphSwaggerReference
  | ITtscEvidenceGraphTypeScriptReference;
