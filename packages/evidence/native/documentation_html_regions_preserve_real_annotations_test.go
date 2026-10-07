package evidence

import (
  "strings"
  "testing"
)

/**
 * TestDocumentationHTMLRegionsPreserveRealAnnotations verifies example comments
 * are inert without treating literal delimiters as comment openings.
 *
 * HTML lexical state belongs inside the extracted host. Removing a Markdown
 * host itself would erase genuine acknowledgements instead of its examples.
 *
 * 1. Place every annotation kind inside closed and unclosed HTML comments.
 * 2. Require a real citation, review and withdrawal after a close to survive.
 * 3. Keep delimiters inside code spans, fences and attributes literal.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct shared parser calls reject citation, exclusion, both review kinds and hiding tags inside HTML examples; real following tags retain their targets and offsets.
 * @evidence contracts/testing.md#independent-expectations HTML comments end at their first closing delimiter; equal backtick spans and quoted attribute values contain literal delimiter bytes rather than HTML comment openings.
 * @evidence contracts/testing.md#distinguishing-cases Closed, unclosed, multiple, CRLF, inline-code, multiline-code, fenced, escaped and attribute-delimiter inputs distinguish lexical region ownership and recovery.
 * @evidence contracts/testing.md#execution-ownership This selectable native Go unit exercises documentation parsers in-process on authored strings without external processes or installation.
 */
func TestDocumentationHTMLRegionsPreserveRealAnnotations(t *testing.T) {
  hidden := "@evidence wrong.md Hidden citation.\n@evidenceExclude wrong.md Hidden exclusion.\n@evidenceReview wrong.md Hidden review.\n@evidenceExcludeReview wrong.md Hidden exclusion review.\n@hidden Not public."
  for _, closer := range []string{"", "\n-->"} {
    t.Run("hidden/"+decimal(len(closer)), func(t *testing.T) {
      body := "<!--\n" + hidden + closer
      if len(parseDeclarations(body)) != 0 || len(parseReviews(body)) != 0 || commentHidingTag(body) != "" {
        t.Fatalf("HTML example became annotation: %q", body)
      }
    })
  }
  for _, prefix := range []string{
    "<!--\n"+hidden+"\n-->\n", "<!-- one --> <!-- two -->\n", "<!-->\n", "<!--->\n",
    "`<!--`\n", "``<!-- ` literal``\n", "`literal\n<!--\nend`\n",
    "<span title=\"<!--\">literal</span>\n", "\\<!--\n", "~~~text\n<!--\n~~~\n",
    "`<!-- literal\\` more prose\n",
    "`before\n~~~text\n@evidence wrong.md Hidden.\n~~~\nend`\n",
    "<span title=\"text\n<!--\n\">literal</span>\n",
  } {
    for _, newline := range []string{"\n", "\r\n"} {
      t.Run("visible/"+decimal(len(prefix))+"/"+decimal(len(newline)), func(t *testing.T) {
        body := strings.ReplaceAll(prefix+"@evidence spec.md Real reason.\n@evidenceReview spec.md Real review.\n@ignore Internal surface.", "\n", newline)
        declarations, reviews := parseDeclarations(body), parseReviews(body)
        if len(declarations) != 1 || declarations[0].Target != "spec.md" || declarations[0].Reason != "Real reason." || declarations[0].LineOffset != strings.Count(prefix, "\n") {
          t.Fatalf("real citation lost after literal/comment: %q %#v", prefix, declarations)
        }
        if len(reviews) != 1 || reviews[0].Description != "Real review." || commentHidingTag(body) != "@ignore" {
          t.Fatalf("real review/withdrawal lost: %q %#v", prefix, reviews)
        }
      })
    }
  }
}
