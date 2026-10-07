package evidence

import (
  "strings"
  "testing"
)

// TestDocumentationFencesEndAnnotationProse verifies an example cannot replace
// the explanation owed by a citation, exclusion or either review kind.
//
// A real fence ends the pending annotation. Closing it does not reopen that
// annotation, so unrelated prose afterwards cannot retroactively supply a reason.
//
// 1. Compare empty and complete explanations before both fence markers.
// 2. Keep post-fence prose separate and read the next genuine annotation.
// 3. Verify the real graph and review rule reject explanation-free annotations.
//
// @evidence contracts/testing.md#behavioral-verification Directly reads returned reasons and review descriptions for four annotation markers and three documentation carriers, then invokes the project and review rules to verify examples do not satisfy nonempty explanations.
// @evidence contracts/testing.md#independent-expectations The annotation contract requires authored prose outside examples. Literal empty or Complete. expectations and malformed diagnostic presence are not derived from parser output.
// @evidence contracts/testing.md#distinguishing-cases Empty and complete explanations, both fence markers, unclosed fences, post-close prose, subsequent real tags, Prisma doc decoration, JSDoc and Markdown HTML hosts preserve the correct boundary and line mapping.
// @evidence contracts/testing.md#execution-ownership The selectable native Go test calls parsers and rule checks in-process; temporary project inputs are resolver fixtures rather than an installed consumer or native host.
func TestDocumentationFencesEndAnnotationProse(t *testing.T) {
  for _, tag := range []string{"@evidence", "@evidenceExclude", "@evidenceReview", "@evidenceExcludeReview"} {
    for _, reason := range []string{"", " Complete."} {
      for _, marker := range []string{"~~~", "```"} {
        for _, host := range []string{"jsdoc", "prisma", "markdown"} {
          t.Run(tag+reason+marker+host, func(t *testing.T) {
            body := tag+" spec.md#rule"+reason+"\n"+marker+"text\nexample only\n"+marker+"\nUnrelated prose.\n@evidence next.md Next."
            if host == "jsdoc" { body = "/**\n * "+strings.ReplaceAll(body, "\n", "\n * ")+"\n */" }
            if host == "prisma" { body = "/// "+strings.ReplaceAll(body, "\n", "\n/// ") }
            expected := strings.TrimSpace(reason)
            if strings.Contains(tag, "Review") {
              reviews := parseReviews(body)
              if len(reviews) != 1 || reviews[0].Description != expected { t.Fatalf("example supplied review prose: %#v", reviews) }
            } else {
              declarations := parseCommentDeclarations(body, host == "prisma")
              if len(declarations) != 2 || declarations[0].Reason != expected || declarations[1].Target != "next.md" { t.Fatalf("example supplied reason: %#v", declarations) }
            }
          })
        }
      }
    }
  }
  declarations := parseDeclarations("@evidence spec.md#rule\n~~~\nexample only")
  if len(declarations) != 1 || declarations[0].Reason != "" { t.Fatal("unclosed fence supplied a reason") }
  inventory, _ := scanProjectMarkdown("claim.md", "# Claim\n<!--\n@evidence spec.md#rule\n~~~\nexample only\n~~~\n-->\n")
  if len(inventory.Declarations) != 1 || inventory.Declarations[0].Reason != "" { t.Fatal("Markdown host's fence supplied a reason") }
  messages := runIndexRule(t, map[string]string{
    "spec.md": "# Rule\n",
    "claim.ts": "/**\n * @evidence spec.md#rule\n * ~~~text\n * example only\n * ~~~\n */\nexport function run(): void {}",
  }, `{"claims":[{"type":"typescript","files":["claim.ts"],"symbol":"function","reference":{"type":"markdown","files":["spec.md"],"symbol":"h1"}}]}`)
  assertProblemContains(t, messages, "Malformed @evidence declaration")
  assertProblemContains(t, messages, "Missing acknowledgement")
  messages = runReviewRule(t, "claim.ts", "/**\n * @evidence spec.md#rule Real reason.\n * @evidenceReview spec.md#rule\n * ~~~\n * example only\n * ~~~\n */\nexport function run(): void {}")
  assertReportedAmong(t, messages, "Malformed @evidenceReview for 'spec.md#rule'")
}
