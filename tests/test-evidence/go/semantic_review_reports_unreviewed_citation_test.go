package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies review reports unreviewed citation.
 *
 * Reviewed evidence and reviewed exclusion are positive twins of unreviewed evidence and an exclusion with the wrong review kind.
 *
 * 1. reviewRule.Check reports missing reviews for refunds/orders and a wrong-kind audit review while accepting pricing and tax review pairs.
 * 2. Literal evidence/review/exclusion tag kinds and named unreviewed/mismatched messages are independent; the near-miss @evidenceReviewed tag must not satisfy a review.
 *
 * @evidence contracts/testing.md#behavioral-verification reviewRule.Check reports missing reviews for refunds/orders and a wrong-kind audit review while accepting pricing and tax review pairs.
 * @evidence contracts/testing.md#independent-expectations Literal evidence/review/exclusion tag kinds and named unreviewed/mismatched messages are independent; the near-miss @evidenceReviewed tag must not satisfy a review.
 * @evidence contracts/testing.md#distinguishing-cases Reviewed evidence and reviewed exclusion are positive twins of unreviewed evidence and an exclusion with the wrong review kind.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticReviewReportsUnreviewedCitation owns these assertions. runReviewRule parses and calls reviewRule.Check for ISale/IOrder/ITax within this one Go test; no reference loader or product host is launched.
 */
func TestEvidenceSemanticReviewReportsUnreviewedCitation(t *testing.T) {
  files := map[string]string{
    "src/ISale.ts":  "/**\n * @evidence docs/spec.md#pricing Derives the sale price from this section.\n * @evidenceReview docs/spec.md#pricing Section caps the rate at 30%; price clamps to 30.\n * @evidence docs/spec.md#refunds Applies the refund window this section sets.\n */\nexport interface ISale {\n  price: number;\n}\n",
    "src/IOrder.ts": "/**\n * @evidence docs/spec.md#orders Places the order this section describes.\n * @evidenceReviewed docs/spec.md#orders Not this rule's tag.\n */\nexport interface IOrder {\n  id: string;\n}\n",
    "src/ITax.ts":   "/**\n * @evidenceExclude docs/spec.md#tax The tax engine owns this, not this type.\n * @evidenceExcludeReview docs/spec.md#tax Read the section: every rule in it names a tax authority.\n * @evidenceExclude docs/spec.md#audit The audit log owns this.\n * @evidenceReview docs/spec.md#audit Filed under the wrong question.\n */\nexport interface ITax {\n  rate: number;\n}\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runReviewRule(t, file, content)...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Unreviewed @evidence for 'docs/spec.md#refunds'") {
    t.Fatalf("missing %q in %s", "Unreviewed @evidence for 'docs/spec.md#refunds'", output)
  }
  if !strings.Contains(output, "Unreviewed @evidence for 'docs/spec.md#orders'") {
    t.Fatalf("missing %q in %s", "Unreviewed @evidence for 'docs/spec.md#orders'", output)
  }
  if !strings.Contains(output, "Add '@evidenceReview docs/spec.md#refunds") {
    t.Fatalf("missing %q in %s", "Add '@evidenceReview docs/spec.md#refunds", output)
  }
  if !strings.Contains(output, "Mismatched @evidenceReview for 'docs/spec.md#audit'") {
    t.Fatalf("missing %q in %s", "Mismatched @evidenceReview for 'docs/spec.md#audit'", output)
  }
  if strings.Contains(output, "Unreviewed @evidence for 'docs/spec.md#pricing'") {
    t.Fatalf("unexpected %q in %s", "Unreviewed @evidence for 'docs/spec.md#pricing'", output)
  }
  if strings.Contains(output, "Unreviewed @evidenceExclude for 'docs/spec.md#tax'") {
    t.Fatalf("unexpected %q in %s", "Unreviewed @evidenceExclude for 'docs/spec.md#tax'", output)
  }
}
