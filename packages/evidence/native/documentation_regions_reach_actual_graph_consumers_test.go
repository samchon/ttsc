package evidence

import (
  "strings"
  "testing"
)

/**
 * TestDocumentationRegionsReachActualGraphConsumers verifies example decisions
 * reach real TypeScript graph/review diagnostics and Markdown annotation hosts.
 *
 * Parser output alone cannot establish that attachment, coverage and review
 * validation consume the same regions and source positions.
 *
 * 1. Run the graph with a literal fence, HTML example and empty fenced reason.
 * 2. Require actual review validation to reject a fenced-only description.
 * 3. Keep genuine Markdown HTML-host citations and reviews readable.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule and runReviewRule execute the actual native graph/review operations; assertions distinguish coverage, missing acknowledgement and malformed reason/description. scanProjectMarkdown retains a real HTML host and its bounded annotation prose.
 * @evidence contracts/testing.md#independent-expectations Only authored annotation prose satisfies acknowledgement/review requirements; literal delimiters cannot erase real tags and examples cannot supply prose. Expected diagnostic substrings and source lines are independent literals.
 * @evidence contracts/testing.md#distinguishing-cases A four-space literal delimiter is the positive twin of real fenced examples; hidden HTML citations and fenced-only reasons fail, while genuine Markdown host tags survive.
 * @evidence contracts/testing.md#execution-ownership One native Go unit invokes the actual in-process rules over temporary resolver inputs; no installed artifact, native producer or product host is involved.
 */
func TestDocumentationRegionsReachActualGraphConsumers(t *testing.T) {
  const config = `{"claims":[{"type":"typescript","files":["claim.ts"],"symbol":"function","reference":{"type":"markdown","files":["spec.md"],"symbol":"h1"}}]}`
  for _, scenario := range []struct {
    name, body, diagnostic string
  }{
    {"literal", "    ~~~text\n@evidence spec.md#rule Actual reason.", ""},
    {"html", "<!--\n@evidence spec.md#rule Hidden example.\n-->", "Missing acknowledgement for 'spec.md#rule'"},
    {"empty", "@evidence spec.md#rule\n~~~text\nexample only\n~~~", "Malformed @evidence declaration"},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      comment := "/**\n * " + strings.ReplaceAll(scenario.body, "\n", "\n * ") + "\n */\nexport function run(): void {}"
      messages := runIndexRule(t, map[string]string{"claim.ts": comment, "spec.md": "# Rule\n"}, config)
      if scenario.diagnostic == "" {
        assertNoProblems(t, messages)
      } else {
        assertReportedAmong(t, messages, scenario.diagnostic)
      }
    })
  }
  t.Run("review", func(t *testing.T) {
    messages := runReviewRule(t, "claim.ts", "/**\n * @evidence spec.md Actual reason.\n * @evidenceReview spec.md\n * ~~~text\n * example only\n * ~~~\n */\nexport function run(): void {}")
    assertReportedAmong(t, messages, "description is empty")
  })
  t.Run("markdown-host", func(t *testing.T) {
    markdown, problems := scanProjectMarkdown("claim.md", "# Claim\n<!--\n@evidence spec.md Actual reason.\n~~~text\nexample only\n~~~\n@evidenceReview spec.md Actual review.\n-->\n")
    assertNoProblems(t, problems)
    if len(markdown.Declarations) != 1 || markdown.Declarations[0].Reason != "Actual reason." || markdown.Declarations[0].Line != 3 || len(markdown.Reviews) != 1 || markdown.Reviews[0].Description != "Actual review." || markdown.Reviews[0].Line != 7 {
      t.Fatalf("genuine Markdown host changed: %#v %#v", markdown.Declarations, markdown.Reviews)
    }
  })
}
