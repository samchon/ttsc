package evidence

import (
  "strings"
  "testing"
)

// TestDocumentationHtmlExamplesAreInert verifies hidden example annotations
// cannot supply coverage, review a citation or withdraw a public declaration.
//
// The artifact scanner owns the outer Markdown comment host. Only HTML comments
// inside the supplied documentation body are examples.
//
// 1. Mask closed, repeated and unterminated HTML examples across all tag kinds.
// 2. Keep literal HTML delimiters in fences and inline code from opening regions.
// 3. Require the actual TypeScript graph to report the uncovered obligation.
//
// @evidence contracts/testing.md#behavioral-verification Exercises declarations, reviews, withdrawal, Markdown inventory and the real project rule. Hidden tags yield no parser result, visible tags retain their target and line, and a hidden-only implementation leaves the reference missing.
// @evidence contracts/testing.md#independent-expectations HTML comments inside documentation render no annotation prose; Markdown's outer comment remains its contract-defined host. Authored targets, line offsets and missing-acknowledgement text are independent expected values.
// @evidence contracts/testing.md#distinguishing-cases Closed, unclosed and repeated comments contrast with visible suffix annotations; backtick spans, tilde fences, indented literals, quoted HTML attributes, unmatched backticks and fake fences inside HTML distinguish lexical precedence. All withdrawal markers and both review kinds are exercised.
// @evidence contracts/testing.md#execution-ownership This Go entry invokes owning parsers and project evaluation in-process with authored temporary fixtures; it starts no product process and performs no installation or plugin build.
func TestDocumentationHtmlExamplesAreInert(t *testing.T) {
  hidden := "@evidence hidden.md Hidden.\n@evidenceExclude hidden.md Excluded.\n@evidenceReview hidden.md #a1b2c3d Reviewed.\n@evidenceExcludeReview hidden.md #a1b2c3d Reviewed.\n@internal\n@hidden\n@ignore\n"
  for name, body := range map[string]string{
    "closed": "<!--\n"+hidden+"-->\n",
    "unclosed": "<!--\n"+hidden,
    "multiple": "<!--\n"+hidden+"-->\n<!--\n"+hidden+"-->\n",
    "fake fence": "<!--\n~~~\n"+hidden+"-->\n",
  } {
    t.Run(name, func(t *testing.T) {
      wrapped := "/**\r\n * "+strings.ReplaceAll(body, "\n", "\r\n * ")+"\r\n */"
      if len(parseDeclarations(wrapped)) != 0 || len(parseReviews(wrapped)) != 0 || commentHidingTag(wrapped) != "" { t.Fatal("HTML example acquired annotation authority") }
    })
  }
  for name, prefix := range map[string]string{
    "closed suffix": "<!-- hidden --> ",
    "empty short comment": "<!--> ",
    "empty dash comment": "<!---> ",
    "closed multiline": "<!--\n~~~\n@hidden\n-->\n",
    "inline literal": "`<!--`\n",
    "double inline literal": "``x ` <!--``\n",
    "fenced literal": "~~~\n<!--\n~~~\n",
    "indented literal": "    <!--\n",
    "double quoted attribute": "<span title=\"<!--\">\n",
    "single quoted attribute": "<span title='<!--'>\n",
  } {
    t.Run(name, func(t *testing.T) {
      body := prefix+"@evidence spec.md#rule Visible.\n@evidenceExcludeReview spec.md#rule #a1b2c3d Visible review.\n@ignore"
      declarations := parseCommentDeclarations(body, true)
      reviews := parseReviews(body)
      if len(declarations) != 1 || declarations[0].Target != "spec.md#rule" || declarations[0].LineOffset != strings.Count(prefix, "\n") { t.Fatalf("literal delimiter hid visible citation: %#v", declarations) }
      if len(reviews) != 1 || reviews[0].Reviews != tagExclude || reviews[0].Description != "Visible review." || commentHidingTag(body) != "@ignore" { t.Fatal("visible review/withdrawal was hidden") }
    })
  }
  if len(parseDeclarations("` unmatched <!--\n@evidence hidden.md Hidden.")) != 0 { t.Fatal("unmatched backtick hid a real HTML opening") }
  if len(parseDeclarations("/**\n * /// @evidence hidden.md Buried.\n */")) != 0 { t.Fatal("Prisma decoration was invented inside a TypeScript block") }
  inventory, _ := scanProjectMarkdown("claim.md", "# Claim\n<!-- @evidence spec.md#rule Real. -->\n")
  if len(inventory.Declarations) != 1 || inventory.Declarations[0].Target != "spec.md#rule" { t.Fatal("outer Markdown HTML host was removed") }
  messages := runIndexRule(t, map[string]string{
    "spec.md": "# Rule\n",
    "claim.ts": "/**\n * <!--\n * @evidence spec.md#rule Hidden example.\n * -->\n */\nexport function run(): void {}",
  }, `{"claims":[{"type":"typescript","files":["claim.ts"],"symbol":"function","reference":{"type":"markdown","files":["spec.md"],"symbol":"h1"}}]}`)
  found := false
  for _, message := range messages { if strings.Contains(message, "Missing acknowledgement for 'spec.md#rule'") { found = true } }
  if !found { t.Fatalf("hidden citation discharged real coverage: %#v", messages) }
}
