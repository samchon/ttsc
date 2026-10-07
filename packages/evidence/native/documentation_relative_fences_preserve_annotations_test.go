package evidence

import (
  "strings"
  "testing"
)

/**
 * TestDocumentationRelativeFencesPreserveAnnotations verifies literal delimiters
 * cannot hide real citations, reviews or withdrawals.
 *
 * Decoration and declaration indentation are not Markdown indentation. The
 * four-column boundary applies after removing their common documentation margin.
 *
 * 1. Parse both marker families with zero through four spaces and tab margins.
 * 2. Require real fences to hide tags and literal delimiters to preserve them.
 * 3. Repeat nested JSDoc and mapped bodies with CRLF and exact source offsets.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual declaration, review and withdrawal parsers and compares selected targets, empty versus present populations, and original line offsets across fence indentation inputs.
 * @evidence contracts/testing.md#independent-expectations The documented three-space fence limit and four-column tab stops determine literal versus real delimiter cases; targets and expected source line indices are authored independently.
 * @evidence contracts/testing.md#distinguishing-cases Both marker families, zero through four spaces, tabs, nested margins, raw mapped bodies and CRLF distinguish relative indentation from unconditional whitespace removal.
 * @evidence contracts/testing.md#execution-ownership This native Go unit calls portable parser operations in-process without a native product build, installed consumer or host.
 */
func TestDocumentationRelativeFencesPreserveAnnotations(t *testing.T) {
  for _, marker := range []string{"~~~", "```"} {
    for _, indent := range []string{"", " ", "  ", "   ", "    ", "\t", " \t"} {
      literal := len(indent) >= 4 || strings.Contains(indent, "\t")
      body := indent + marker + "text\n@evidence spec.md#rule Actual reason.\n@evidenceReview spec.md#rule Actual review.\n@internal Actual withdrawal.\n"
      for _, nested := range []bool{false, true} {
        comment := body
        expectedLine := 1
        if nested {
          comment = "  /**\n   * " + strings.ReplaceAll(strings.TrimSuffix(body, "\n"), "\n", "\n   * ") + "\n   */"
          expectedLine = 2
        }
        for _, crlf := range []bool{false, true} {
          if crlf {
            comment = strings.ReplaceAll(comment, "\n", "\r\n")
          }
          t.Run(marker+"/"+indent+"/"+decimal(expectedLine)+"/"+decimal(len(comment)), func(t *testing.T) {
            declarations := parseDeclarations(comment)
            reviews := parseReviews(comment)
            hidden := commentHidingTag(comment)
            if !literal {
              if len(declarations) != 0 || len(reviews) != 0 || hidden != "" {
                t.Fatalf("real unclosed fence exposed annotations: %#v %#v %q", declarations, reviews, hidden)
              }
              return
            }
            if len(declarations) != 1 || declarations[0].Target != "spec.md#rule" || declarations[0].Reason != "Actual reason." || declarations[0].LineOffset != expectedLine {
              t.Fatalf("literal fence lost citation or location: %#v", declarations)
            }
            if len(reviews) != 1 || reviews[0].Description != "Actual review." || reviews[0].LineOffset != expectedLine+1 || hidden != "@internal" {
              t.Fatalf("literal fence lost review/withdrawal: %#v %q", reviews, hidden)
            }
          })
        }
      }
    }
  }
}
