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
 */
func TestAMarkdownCitationWrittenAsProseIsReported(t *testing.T) {
  assertReported(
    t,
    runProseTagRule(t, "@evidence docs/spec/rules.md#pricing Written as prose.\n"),
    "Unreadable @evidence at docs/claim/plan.md:5",
  )
}

/**
 * Verifies an exclusion written as prose is reported.
 *
 * The exclusion is the worse of the two to lose. Its reason field makes it read
 * as a reviewed decision to leave something uncovered, so an author who writes
 * one and hears nothing believes a judgement was recorded when none was.
 *
 *  1. Write an exclusion as an ordinary paragraph line.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 */
func TestAMarkdownExclusionWrittenAsProseIsReported(t *testing.T) {
  assertReported(
    t,
    runProseTagRule(t, "@evidenceExclude docs/spec/rules.md#pricing A decision nothing recorded.\n"),
    "Unreadable @evidenceExclude at docs/claim/plan.md:5",
  )
}

/**
 * Verifies a review written as prose is reported under the tag it was written
 * as.
 *
 * A review that reaches nothing can never expire and never satisfy anything,
 * which is the one outcome `requireReview` exists to make impossible. The two
 * review tags answer different questions, so the diagnostic has to name the one
 * the author actually wrote.
 *
 *  1. Write a review of an exclusion as an ordinary paragraph line.
 *  2. Evaluate the same claim.
 *  3. Assert it is reported as `@evidenceExcludeReview`.
 */
func TestAMarkdownReviewWrittenAsProseIsReported(t *testing.T) {
  assertReported(
    t,
    runProseTagRule(t, "@evidenceExcludeReview docs/spec/rules.md#pricing Read and agreed.\n"),
    "Unreadable @evidenceExcludeReview at docs/claim/plan.md:5",
  )
}

/**
 * Verifies an example is not reported.
 *
 * This is the population the repair must leave silent, and it is not a
 * concession: this product's own documentation shows tags inside fences, so
 * reporting them would fail its build. Both fence spellings and the indented
 * form are the same case, and a sentence that merely mentions a tag is a fourth,
 * because a declaration has to open its line.
 *
 *  1. Write a tag inside each of the three code forms and inside a sentence.
 *  2. Evaluate the same claim.
 *  3. Assert nothing is reported.
 */
func TestAMarkdownTagInsideAnExampleIsNotReported(t *testing.T) {
  for name, plan := range map[string]string{
    "backtick fence": "```md\n@evidence docs/spec/rules.md#pricing Inside a fence.\n```\n",
    "tilde fence":    "~~~\n@evidence docs/spec/rules.md#pricing Inside a fence.\n~~~\n",
    "indented block": "    @evidence docs/spec/rules.md#pricing Indented as code.\n",
    "mid-sentence":   "The tag @evidence names a target and a reason.\n",
  } {
    t.Run(name, func(t *testing.T) {
      assertNoProblems(t, runProseTagRule(t, plan))
    })
  }
}

/**
 * Verifies a tag inside an HTML comment is untouched.
 *
 * Every case above asserts that something new is said, and a reporter that said
 * it about every tag would satisfy them all while making the rule unusable. A
 * comment spanning several lines is the shape that fails first if the scan
 * forgets it is still inside one, and it is the only citation here, so the
 * assertion also proves the tag was read rather than merely unreported.
 *
 *  1. Write a multi-line comment carrying the document's only citation.
 *  2. Evaluate the same claim.
 *  3. Assert nothing is reported, so it was read and not named.
 */
func TestAMarkdownTagInsideACommentIsNotReported(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec/rules.md": "## Pricing {#pricing}\n",
    "docs/claim/plan.md": "## Plan {#plan}\n\n<!--\n@evidence docs/spec/rules.md#pricing Inside a multi-line comment.\n-->\n",
  }, proseTagConfig))
}
