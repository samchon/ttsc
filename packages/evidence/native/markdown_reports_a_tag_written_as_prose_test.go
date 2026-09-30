package evidence

import (
  "testing"
)

// proseTagConfig cites Markdown from Markdown, which is the only arrangement
// where a citation and the section it names can both be prose.
const proseTagConfig = `{"claims":[{
  "type":"markdown",
  "files":["docs/claim/**/*.md"],
  "symbol":"h2",
  "reference":{"type":"markdown","files":["docs/spec/**/*.md"],"symbol":"h2"}
}]}`

// runProseTagRule evaluates one claim document against one specification
// section that a real comment in the same document already acknowledges.
//
// The acknowledgement is there so the obligation is discharged and the only
// diagnostics left are the ones a case is about. Without it every case would
// also carry a coverage finding and could not count.
func runProseTagRule(t *testing.T, plan string) []string {
  t.Helper()
  return runIndexRule(t, map[string]string{
    "docs/spec/rules.md": "## Pricing {#pricing}\n",
    "docs/claim/plan.md": "## Plan {#plan}\n\n" +
      "<!-- @evidence docs/spec/rules.md#pricing The real citation. -->\n\n" + plan,
  }, proseTagConfig)
}

/**
 * Verifies a citation written as prose is reported.
 *
 * A Markdown declaration is read from an HTML comment, so the tag renders
 * invisibly and an author sees the same source whichever way they wrote it.
 * Written as prose it reached no host and was discarded without a word, which
 * left the coverage diagnostic that follows naming the reference and suggesting
 * the citation the author had already written. TypeScript answers this shape
 * and the Prisma bridge answers its own; this was the kind left silent.
 *
 *  1. Write a citation as an ordinary paragraph line.
 *  2. Evaluate a Markdown claim over the document.
 *  3. Assert the tag is reported at its own line.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies a citation written as prose is reported.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The authored prose citation is unreadable at docs/claim/plan.md:5; a separate real comment already discharges coverage, isolating that literal report.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Write a citation as an ordinary paragraph line. Evaluate a Markdown claim over the document. Assert the tag is reported at its own line.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestAMarkdownCitationWrittenAsProseIsReported is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestAMarkdownCitationWrittenAsProseIsReported(t *testing.T) {
  assertReported(
    t,
    runProseTagRule(t, "@evidence docs/spec/rules.md#pricing Written as prose.\n"),
    "Unreadable @evidence at docs/claim/plan.md:5",
  )
}
