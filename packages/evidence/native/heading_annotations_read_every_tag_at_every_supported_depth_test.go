package evidence

import (
  "strings"
  "testing"
)

/**
 * TestHeadingAnnotationsReadEveryTagAtEverySupportedDepth verifies an H2, H3
 * or H4 heading opens each of the five annotation tags with its explanation
 * below.
 *
 * The heading carries the tag and the target, and the lines under it are the
 * reason or the review description, including blank lines, a list and a deeper
 * ordinary heading. Closing hashes and an explicit anchor belong to the heading
 * and must reach neither the target nor the reason. A review's fingerprint may
 * sit on its heading or open the description below it.
 *
 *  1. Build one JSDoc block holding every tag at one depth, in LF and in CRLF.
 *  2. Parse its citations and its reviews with the shared parsers.
 *  3. Require each target, explanation, fingerprint and opening line exactly.
 *
 * @evidence contracts/testing.md#behavioral-verification parseDeclarations and parseReviews run on JSDoc blocks with heading-form `@evidence`, `@evidenceExclude`, `@link`, `@evidenceReview` and `@evidenceExcludeReview` at depths two, three and four; the case compares every parsed tag, target, reason, fingerprint, description and LineOffset with literal expectations.
 * @evidence contracts/testing.md#independent-expectations The expected values follow the heading grammar: the heading supplies tag and target, the explanation is the text below up to the next annotation with blank lines kept, closing hashes and `{#anchor}` are heading syntax, and the line offset is the heading's line in the block. None is read back from the parser.
 * @evidence contracts/testing.md#distinguishing-cases Three depths, two newline conventions, a deeper ordinary heading inside the explanation, a file-link target, and a fingerprint written on the heading versus opening the description; boundaries, malformed sections and inert headings are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestHeadingAnnotationsReadEveryTagAtEverySupportedDepth is a native Go unit entry that parses in-memory strings in the test process, with no filesystem, product host or installed consumer.
 */
func TestHeadingAnnotationsReadEveryTagAtEverySupportedDepth(t *testing.T) {
  for _, depth := range []string{"##", "###", "####"} {
    for _, newline := range []string{"\n", "\r\n"} {
      t.Run(depth+"/"+strings.ReplaceAll(strings.ReplaceAll(newline, "\r", "CR"), "\n", "LF"), func(t *testing.T) {
        lines := []string{
          "/**",
          " * Handles one request.",
          " *",
          " * " + depth + " @evidence docs/spec.md#auth {#explicit-anchor} " + depth,
          " *",
          " * Validates the token.",
          " *",
          " * " + depth + "# Steps",
          " *",
          " * - Checks the signature.",
          " *",
          " * " + depth + " @evidenceExclude docs/spec.md#billing",
          " *",
          " * Billing belongs to another service.",
          " * " + depth + " @link ../src/run.ts#run",
          " * Calls run once per request.",
          " * " + depth + " @evidenceReview docs/spec.md#auth #abcdef0",
          " * Checked the signature path.",
          " * " + depth + " @evidenceExcludeReview docs/spec.md#billing",
          " * #1234567 Confirmed that billing lives elsewhere.",
          " */",
        }
        block := strings.Join(lines, newline)
        declarations := parseDeclarations(block)
        if len(declarations) != 3 {
          t.Fatalf("expected three acknowledgements, got %#v", declarations)
        }
        expectedDeclarations := []struct {
          tag    tagKind
          target string
          reason string
          line   int
        }{
          {tagEvidence, "docs/spec.md#auth", "Validates the token.\n\n" + depth + "# Steps\n\n- Checks the signature.", 3},
          {tagExclude, "docs/spec.md#billing", "Billing belongs to another service.", 11},
          {tagEvidence, "../src/run.ts#run", "Calls run once per request.", 14},
        }
        for index, expected := range expectedDeclarations {
          actual := declarations[index]
          if actual.Tag != expected.tag ||
            displayTarget(actual.Target) != expected.target ||
            actual.Reason != expected.reason ||
            actual.LineOffset != expected.line {
            t.Fatalf("acknowledgement %d: got %#v, want %#v", index, actual, expected)
          }
        }
        if !isFileLinkTarget(declarations[2].Target) {
          t.Fatalf("a heading-form @link lost its file-link target kind: %#v", declarations[2])
        }

        reviews := parseReviews(block)
        expectedReviews := []parsedReview{
          {Reviews: tagEvidence, Target: "docs/spec.md#auth", Fingerprint: "abcdef0", Description: "Checked the signature path.", LineOffset: 16},
          {Reviews: tagExclude, Target: "docs/spec.md#billing", Fingerprint: "1234567", Description: "Confirmed that billing lives elsewhere.", LineOffset: 18},
        }
        if len(reviews) != len(expectedReviews) {
          t.Fatalf("expected two reviews, got %#v", reviews)
        }
        for index, expected := range expectedReviews {
          if reviews[index] != expected {
            t.Fatalf("review %d: got %#v, want %#v", index, reviews[index], expected)
          }
        }
      })
    }
  }
}
