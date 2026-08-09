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

/**
 * Verifies a citation carried by a list or a quote is reported.
 *
 * A bullet is how a reader most naturally writes a citation into a plan, and a
 * quote is how they paste one from elsewhere. Both were silent, because the tag
 * has to be the first content on its line and a marker was counted as content,
 * so the shape this rule exists for went on reproducing itself in the two
 * spellings an author is most likely to reach for.
 *
 * The mid-sentence row is the negative twin the marker rule must not break: a
 * line has to open with the tag once its markers come off, or a sentence that
 * mentions one would be reported as a declaration.
 *
 *  1. Write a citation behind each marker, and one mid-sentence.
 *  2. Evaluate the same claim.
 *  3. Assert the carried ones are reported and the sentence is not.
 */
func TestAMarkdownCitationBehindAMarkerIsReported(t *testing.T) {
  for name, plan := range map[string]string{
    "bullet":        "- @evidence docs/spec/rules.md#pricing The bullet form.\n",
    "asterisk":      "* @evidence docs/spec/rules.md#pricing The asterisk form.\n",
    "ordered":       "1. @evidence docs/spec/rules.md#pricing The ordered form.\n",
    "quote":         "> @evidence docs/spec/rules.md#pricing The quoted form.\n",
    "quoted bullet": "> - @evidence docs/spec/rules.md#pricing Both markers.\n",
  } {
    t.Run(name, func(t *testing.T) {
      assertReported(t, runProseTagRule(t, plan), "Unreadable @evidence at docs/claim/plan.md:5")
    })
  }
  assertNoProblems(t, runProseTagRule(t, "The tag @evidence names a target and a reason.\n"))
}

/**
 * Verifies an example that renders as code without being a fence is not
 * reported.
 *
 * A documentation site shows examples through more than one syntax: an MDX page
 * passes a template literal to a component and an HTML page uses `<pre>`. Both
 * render as code, so both are examples in the sense a fence is, and the repair
 * this diagnostic names would delete the example from the rendered page instead
 * of fixing anything. This repository's own pages use fences, so the exposure
 * is a consumer's docs site and the cost is their build.
 *
 *  1. Write a citation inside each rendered-code syntax.
 *  2. Evaluate the same claim.
 *  3. Assert neither is reported.
 */
func TestAMarkdownTagInsideRenderedCodeIsNotReported(t *testing.T) {
  for name, plan := range map[string]string{
    "mdx component": "<Code lang=\"md\" code={`\n@evidence docs/spec/rules.md#pricing Example.\n`} />\n",
    "html pre":      "<pre>\n@evidence docs/spec/rules.md#pricing Example.\n</pre>\n",
  } {
    t.Run(name, func(t *testing.T) {
      assertNoProblems(t, runProseTagRule(t, plan))
    })
  }
}

/**
 * Verifies every prose tag in one document is reported, and that a closed fence
 * releases the lines after it.
 *
 * One report per tag, because each is its own declaration and an author fixing
 * the first should not have to build again to learn about the second. The fence
 * row is the state machine's other direction: a reporter that treated every
 * line after an opening fence as fenced would satisfy the fence cases while
 * silencing the whole rest of the document.
 *
 *  1. Close a fence, then write two citations after it.
 *  2. Evaluate the same claim.
 *  3. Assert both are reported at their own lines.
 */
func TestEveryMarkdownProseTagIsReported(t *testing.T) {
  messages := runProseTagRule(t, "```md\n<!-- an example -->\n```\n\n"+
    "@evidence docs/spec/rules.md#pricing The first.\n\n"+
    "@evidence docs/spec/rules.md#pricing The second.\n")
  assertReportedAmong(t, messages, "Unreadable @evidence at docs/claim/plan.md:9")
  assertReportedAmong(t, messages, "Unreadable @evidence at docs/claim/plan.md:11")
}
