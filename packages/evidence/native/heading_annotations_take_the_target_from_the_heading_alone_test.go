package evidence

import (
  "testing"
)

/**
 * TestHeadingAnnotationsTakeTheTargetFromTheHeadingAlone verifies a heading
 * annotation cannot borrow a target, a reason or a description it did not
 * write.
 *
 * A heading section names its target on the heading. The explanation below
 * may supply the reason but never the target, so a heading with no target
 * stays malformed even when the next line starts with a valid one, and an
 * unterminated inline link on the heading cannot close on a brace in the prose
 * under it. An example is skipped rather than ending the section, so it can
 * neither supply a missing reason nor hide the prose after it.
 *
 *  1. Parse targetless, reasonless, example-only and description-less sections.
 *  2. Contrast each with the line form or with prose after the example.
 *  3. Require the malformed parts to stay empty and the written parts to survive.
 *
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations and parseReviews run on heading sections with an empty heading body, an inline link the heading leaves unterminated, an empty explanation, an explanation made only of a fenced example, an example followed by prose, a reason written on the heading itself and a review without a description; each subtest compares targets, reasons, fingerprints and descriptions with literals.
 * @evidence contracts/testing.md#independent-expectations The expectations follow the section contract: the target is split from the heading alone, a missing reason or description stays empty so the graph reports it as malformed, an example supplies no text and the explanation resumes after it, and the line form keeps its documented cross-line target.
 * @evidence contracts/testing.md#distinguishing-cases The targetless heading is contrasted with the target-bearing next line it must not adopt, the heading-form link with the line form that does read across lines, the example-only explanation with an example followed by prose, and the empty review description with its retained fingerprint.
 * @evidence contracts/testing.md#execution-ownership TestHeadingAnnotationsTakeTheTargetFromTheHeadingAlone is a native Go unit entry that parses in-memory strings in the test process with no filesystem or product host.
 */
func TestHeadingAnnotationsTakeTheTargetFromTheHeadingAlone(t *testing.T) {
  t.Run("an empty heading cannot adopt the next line as its target", func(t *testing.T) {
    declarations := parseDeclarations("## @evidence\ndocs/a.md#x Reason below.")
    if len(declarations) != 1 || declarations[0].Target != "" {
      t.Fatalf("the explanation became a target: %#v", declarations)
    }
    if line := parseDeclarations("@evidence\ndocs/a.md#x Reason below."); len(line) != 1 || line[0].Target != "docs/a.md#x" {
      t.Fatalf("the line form must keep its cross-line target: %#v", line)
    }
  })
  t.Run("an unterminated link cannot close on the explanation", func(t *testing.T) {
    declarations := parseDeclarations("## @evidence {@link\nSale} Explains the sale.")
    if len(declarations) != 1 || isInlineLinkTarget(declarations[0].Target) {
      t.Fatalf("the heading link borrowed a brace from the explanation: %#v", declarations)
    }
    if line := parseDeclarations("@evidence {@link\nSale} Explains the sale."); len(line) != 1 || !isInlineLinkTarget(line[0].Target) {
      t.Fatalf("the line form reads its link across lines: %#v", line)
    }
  })
  t.Run("an empty explanation is no reason", func(t *testing.T) {
    declarations := parseDeclarations("## @evidence docs/a.md#x\n\n## Next\nOutside.")
    if len(declarations) != 1 || declarations[0].Target != "docs/a.md#x" || declarations[0].Reason != "" {
      t.Fatalf("a reason appeared from outside the section: %#v", declarations)
    }
  })
  t.Run("an example is no reason", func(t *testing.T) {
    declarations := parseDeclarations("## @evidence docs/a.md#x\n~~~text\nExample only.\n~~~")
    if len(declarations) != 1 || declarations[0].Reason != "" {
      t.Fatalf("the example supplied a reason: %#v", declarations)
    }
  })
  t.Run("prose after an example still explains", func(t *testing.T) {
    declarations := parseDeclarations("## @evidence docs/a.md#x\n~~~text\n@evidence hidden.md Inside the example.\n~~~\nAfter the example.")
    if len(declarations) != 1 || declarations[0].Target != "docs/a.md#x" || declarations[0].Reason != "After the example." {
      t.Fatalf("the section did not resume after its example: %#v", declarations)
    }
  })
  t.Run("a reason may sit on the heading", func(t *testing.T) {
    declarations := parseDeclarations("### @evidenceExclude docs/a.md#x Not owned here.")
    if len(declarations) != 1 || declarations[0].Tag != tagExclude || declarations[0].Reason != "Not owned here." {
      t.Fatalf("the heading's own reason was lost: %#v", declarations)
    }
  })
  t.Run("a review keeps its fingerprint without a description", func(t *testing.T) {
    reviews := parseReviews("## @evidenceReview docs/a.md#x #abcdef0\n\n## Next\nOutside.")
    if len(reviews) != 1 || reviews[0].Fingerprint != "abcdef0" || reviews[0].Description != "" {
      t.Fatalf("a description appeared from outside the section: %#v", reviews)
    }
  })
}
