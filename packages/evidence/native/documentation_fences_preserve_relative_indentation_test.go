package evidence

import (
  "strings"
  "testing"
)

// TestDocumentationFencesPreserveRelativeIndentation verifies literal delimiters
// cannot hide a later citation, review or withdrawal.
//
// Decoration is not documentation indentation. Nested block formatting and
// mapped Prisma bodies must measure the same four-column boundary.
//
// 1. Compare real zero-to-three-column fences with four-column and tab literals.
// 2. Read citations, reviews and hiding tags through native and mapped bodies.
// 3. Exercise the real TypeScript graph with a literal delimiter before a citation.
//
// @evidence contracts/testing.md#behavioral-verification Calls all three parser consumers and runIndexRule, checking literal targets, fingerprints, reasons, hiding tags and original line offsets; real and unterminated fences suppress annotations while literal delimiters do not.
// @evidence contracts/testing.md#independent-expectations The documentation grammar permits real fences only within three visual columns of the common baseline; four-column indentation and tabs at four-column stops are literal code. Expected targets, offsets and graph silence are authored constants.
// @evidence contracts/testing.md#distinguishing-cases Covers both markers, CRLF, nested decoration, mapped Prisma bodies, zero through four spaces, tabs, closing length and remainder, unterminated fences and real tags after closure.
// @evidence contracts/testing.md#execution-ownership The selectable Go entry calls native parser operations and the project rule in-process on caller-owned fixture files; no installed host or produced native plugin is involved.
func TestDocumentationFencesPreserveRelativeIndentation(t *testing.T) {
  for _, marker := range []string{"~~~", "```"} {
    for _, padding := range []string{"", " ", "  ", "   ", "    ", "\t", " \t"} {
      for _, host := range []string{"jsdoc", "nested", "prisma", "mapped"} {
        t.Run(marker+"/"+padding+"/"+host, func(t *testing.T) {
          body := padding+marker+"text\n@evidence spec.md#rule Real reason.\n@evidenceReview spec.md#rule #a1b2c3d Real review.\n@hidden\n"
          switch host {
          case "jsdoc": body = "/**\n * "+strings.ReplaceAll(strings.TrimSuffix(body, "\n"), "\n", "\n * ")+"\n */"
          case "nested": body = "  /**\r\n     * "+strings.ReplaceAll(strings.TrimSuffix(body, "\n"), "\n", "\r\n     * ")+"\r\n     */"
          case "prisma": body = "/// "+strings.ReplaceAll(strings.TrimSuffix(body, "\n"), "\n", "\n/// ")
          }
          declarations := parseCommentDeclarations(body, host == "prisma" || host == "mapped")
          reviews := parseReviews(body)
          literal := padding == "    " || strings.Contains(padding, "\t")
          if !literal {
            if len(declarations) != 0 || len(reviews) != 0 || commentHidingTag(body) != "" { t.Fatal("an unterminated real fence exposed annotations") }
            return
          }
          offset := 1
          if host == "jsdoc" || host == "nested" { offset++ }
          if len(declarations) != 1 || declarations[0].Target != "spec.md#rule" || declarations[0].Reason != "Real reason." || declarations[0].LineOffset != offset { t.Fatalf("literal delimiter lost citation/mapping: %#v", declarations) }
          if len(reviews) != 1 || reviews[0].Fingerprint != "a1b2c3d" || reviews[0].Description != "Real review." || reviews[0].LineOffset != offset+1 { t.Fatalf("literal delimiter lost review/mapping: %#v", reviews) }
          if commentHidingTag(body) != "@hidden" { t.Fatal("literal delimiter lost withdrawal") }
        })
      }
    }
  }
  for name, prefix := range map[string]string{
    "longer close": "~~~~\n~~~\n@evidence hidden.md Hidden.\n~~~~~\n",
    "closing remainder": "~~~\n~~~ trailing\n@evidence hidden.md Hidden.\n~~~\n",
    "different marker": "~~~\n```\n@evidence hidden.md Hidden.\n~~~\n",
    "backtick info literal": "```info`\n",
  } {
    t.Run(name, func(t *testing.T) {
      declarations := parseDeclarations(prefix+"@evidence spec.md#rule Real reason.")
      if len(declarations) != 1 || declarations[0].Target != "spec.md#rule" { t.Fatalf("fence boundary consumed wrong annotation: %#v", declarations) }
    })
  }
  assertSilent(t, runIndexRule(t, map[string]string{
    "spec.md": "# Rule\n",
    "claim.ts": "/**\n *     ~~~text\n * @evidence spec.md#rule Real reason.\n */\nexport function run(): void {}",
  }, `{"claims":[{"type":"typescript","files":["claim.ts"],"symbol":"function","reference":{"type":"markdown","files":["spec.md"],"symbol":"h1"}}]}`))
}
