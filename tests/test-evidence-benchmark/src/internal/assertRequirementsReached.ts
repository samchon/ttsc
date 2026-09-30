import type { IMissingAcknowledgement } from "./evidenceDiagnostics";
import { BenchmarkClaimReferences } from "./BenchmarkClaimReferences";
import { requirementDocumentsDeclaringSections } from "./requirementDocuments";

/**
 * Require every delivered section document when the claim declares Markdown.
 *
 * Reference kinds come from the owning configuration, so zero observed Markdown
 * obligations cannot turn a Markdown reference into an exemption. Each Markdown
 * reference is checked independently; a healthy sibling cannot hide an empty
 * reference. Targets from another document remain invalid for every claim.
 *
 * Addresses retain basename matching. A matching name beneath a different root
 * is not authenticated here; duplicate delivered basenames reject as ambiguous.
 *
 * @evidence contracts/common.md#principled-implementation Declared reference indices select obligations before document completeness is checked; every section-bearing delivered document is required even when the observed Markdown population is zero.
 * @evidence contracts/common.md#clear-and-simple-design Configuration syntax and delivered section discovery retain their existing owners; this operation owns the comparison and failure messages only.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An empty diagnostic population does not determine applicability; no host output or expected document is fabricated to satisfy the comparison.
 * @evidence contracts/common.md#meaningful-documentation Native prose separates declaration authority, independent reference checks and foreign-document rejection from native activation execution.
 * @evidence contracts/performance.md#efficient-algorithms The delivered document list is read once and each obligation once; sets index observed basenames per declared reference for linear completeness checks.
 * @evidence contracts/portability.md#os-neutral-implementation Diagnostic addresses use protocol slash spelling while the existing document owner reads native filesystem paths; basename comparison preserves the suite's original root-independent address contract.
 */
export function assertRequirementsReached(
  workspace: string,
  configuration: string,
  claim: string,
  obligations: readonly IMissingAcknowledgement[],
): void {
  const kinds = BenchmarkClaimReferences.read(configuration, claim);
  if (!kinds.includes("markdown")) {
    for (const obligation of obligations)
      if (
        obligation.claim === claim &&
        obligation.target.split("#", 1)[0]!.endsWith(".md")
      )
        throw new Error(
          `Claim '${claim}' reference ${obligation.reference} reported Markdown without declaring a Markdown reference.`,
        );
    return;
  }
  const expected = requirementDocumentsDeclaringSections(workspace);
  const delivered = new Set(expected.map(basename));
  if (delivered.size !== expected.length)
    throw new Error(
      "Delivered requirement documents have ambiguous duplicate basenames.",
    );
  const reached = new Map<number, Set<string>>();
  for (const obligation of obligations) {
    if (obligation.claim !== claim) continue;
    const file = obligation.target.split("#", 1)[0]!;
    if (!file.endsWith(".md")) continue;
    const name = basename(file);
    if (!delivered.has(name))
      throw new Error(
        `Claim '${claim}' demanded evidence from '${file}', which is not a delivered requirement document.`,
      );
    if (kinds[obligation.reference - 1] !== "markdown")
      throw new Error(
        `Claim '${claim}' reference ${obligation.reference} reported Markdown without declaring a Markdown reference.`,
      );
    let documents = reached.get(obligation.reference);
    if (documents === undefined)
      reached.set(obligation.reference, (documents = new Set()));
    documents.add(name);
  }
  kinds.forEach((kind, index) => {
    if (kind !== "markdown") return;
    if (expected.length === 0)
      throw new Error(
        `Claim '${claim}' declares Markdown but no delivered requirement document has a section.`,
      );
    const missing = expected.filter(
      (document) => !reached.get(index + 1)?.has(basename(document)),
    );
    if (missing.length !== 0)
      throw new Error(
        `Claim '${claim}' reference ${index + 1} demanded evidence from only part of the delivered requirements; nothing was owed for ${missing.join(", ")}.`,
      );
  });
}

function basename(file: string): string {
  return file.slice(file.lastIndexOf("/") + 1);
}
