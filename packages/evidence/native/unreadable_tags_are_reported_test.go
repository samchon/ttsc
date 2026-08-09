package evidence

import (
  "testing"
)

// unreadableTagConfig selects the variables a destructuring pattern declares,
// so the shapes below are inside a population rather than beside one.
const unreadableTagConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":"property",
  "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
}]}`

// runUnreadableRule evaluates one source file against a Markdown section that
// the file's first declarator acknowledges.
//
// The acknowledgement is there so the obligation is discharged and the only
// diagnostics left are the ones a case is about. Without it every case would
// also carry a coverage finding, and an assertion that counts diagnostics could
// not tell the two apart.
func runUnreadableRule(t *testing.T, source string) []string {
  t.Helper()
  return runIndexRule(t, map[string]string{
    "docs/spec.md":     "## Pricing {#pricing}\n",
    "src/contracts.ts": source,
  }, unreadableTagConfig)
}

/**
 * Verifies a citation between the braces of a pattern is reported.
 *
 * TypeScript attaches no documentation to a binding element, so this block
 * reaches no node: the tag in it lands on no host and is cut out of no digest.
 * Discarding it in silence left an author reading a citation that does nothing,
 * while the coverage diagnostic that followed named the reference and suggested
 * writing the citation they had already written.
 *
 *  1. Write a citation between the braces of a destructuring pattern.
 *  2. Evaluate a claim selecting the variables it declares.
 *  3. Assert the tag is reported at its own line.
 */
func TestACitationInsideAPatternIsReported(t *testing.T) {
  assertReportedAmong(t, runUnreadableRule(t, `declare const source: { gamma: number; delta: number };
/** @evidence docs/spec.md#pricing The statement cites this. */
export const {
  /** @evidence docs/spec.md#pricing A tag between the braces. */
  gamma,
  delta,
} = source;
`), "Unreadable @evidence at src/contracts.ts:4")
}

/**
 * Verifies an exclusion in the same position is reported.
 *
 * The exclusion is the worse of the two to lose. Its reason field makes it read
 * as a reviewed decision to leave something uncovered, so an author who writes
 * one and hears nothing believes a judgement was recorded when none was.
 *
 *  1. Write an exclusion between the braces of a destructuring pattern.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 */
func TestAnExclusionInsideAPatternIsReported(t *testing.T) {
  assertReportedAmong(t, runUnreadableRule(t, `declare const source: { gamma: number; delta: number };
/** @evidence docs/spec.md#pricing The statement cites this. */
export const {
  /** @evidenceExclude docs/spec.md#pricing A decision nothing recorded. */
  gamma,
  delta,
} = source;
`), "Unreadable @evidenceExclude at src/contracts.ts:4")
}

/**
 * Verifies a review in the same position is reported.
 *
 * A review written where nothing reads it can never expire and never satisfy
 * anything, which is the one outcome `requireReview` exists to make impossible.
 *
 *  1. Write a review between the braces of a destructuring pattern.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported under the name it was written as.
 */
func TestAReviewInsideAPatternIsReported(t *testing.T) {
  assertReportedAmong(t, runUnreadableRule(t, `declare const source: { gamma: number; delta: number };
/** @evidence docs/spec.md#pricing The statement cites this. */
export const {
  /** @evidenceReview docs/spec.md#pricing #0000000 Read and agreed. */
  gamma,
  delta,
} = source;
`), "Unreadable @evidenceReview at src/contracts.ts:4")
}

/**
 * Verifies a citation in a line comment is reported.
 *
 * TypeScript discards `//` as documentation, so a tag there is unreadable in
 * exactly the way the pattern shapes are, and it is one keystroke from a block
 * that would work. The decision to report it is stated here rather than left to
 * be inferred from the parser's behavior.
 *
 *  1. Write a citation in a line comment above a declaration.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 */
func TestACitationInALineCommentIsReported(t *testing.T) {
  assertReportedAmong(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

// @evidence docs/spec.md#pricing A tag nothing reads.
export const other = 2;
`), "Unreadable @evidence at src/contracts.ts:4")
}

/**
 * Verifies a tag the parser does attach is not reported.
 *
 * Every case above asserts that something new is said, and a reporter that says
 * it about every tag would satisfy all of them while making the rule unusable.
 * This is the population the repair must leave silent, and it is the ordinary
 * one: a block above a declaration, which is where citations are written.
 *
 *  1. Cite a section from a documentation block on a declaration.
 *  2. Evaluate the same claim.
 *  3. Assert nothing is reported at all.
 */
func TestAnAttachedTagIsNotReported(t *testing.T) {
  assertNoProblems(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;
`))
}

/**
 * Verifies a tag-shaped line inside a template literal is not reported.
 *
 * A comment is a lexical question the parser owns, not a search for slashes:
 * inside a template literal the same bytes are ordinary text. Reporting one
 * would be a diagnostic about a string, naming a repair that would corrupt it.
 * This is what the parser-aware comment enumeration buys, and it is the case
 * that fails first if the scan is ever replaced with one over raw text.
 *
 *  1. Write a line opening with a citation inside a template literal.
 *  2. Evaluate the same claim.
 *  3. Assert nothing is reported.
 */
func TestATagShapedLineInATemplateIsNotReported(t *testing.T) {
  assertNoProblems(t, runUnreadableRule(t, "/** @evidence docs/spec.md#pricing The declaration cites this. */\n"+
    "export const limit = `\n"+
    "@evidence docs/spec.md#pricing Prose that merely looks like a tag.\n"+
    "`;\n"))
}

/**
 * Verifies a line comment above a documented declaration is reported.
 *
 * A documentation node's reported start is its full start, so its span reaches
 * back to the previous token and swallows every comment between. Testing an
 * enumerated comment for containment in that span therefore answered
 * differently depending on what followed the tag: reported above an
 * undocumented declaration, silent above a documented one. The second is the
 * shape an author writes in a codebase that documents its exports, and it left
 * the run reporting only the coverage finding that tells them to write the
 * citation they had already written.
 *
 *  1. Write a citation in a line comment directly above a documentation block.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 */
func TestALineCommentAboveADocumentedDeclarationIsReported(t *testing.T) {
  assertReported(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

// @evidence docs/spec.md#pricing A tag nothing reads.
/** The other rate. */
export const other = 2;
`), "Unreadable @evidence at src/contracts.ts:4")
}

/**
 * Verifies a tag behind any run of slashes is reported.
 *
 * Prisma answers a tag buried behind a fourth slash, and the reasons carry
 * over: the comment is real, the file keeps it, and the tag is unreadable by
 * one keystroke. Answering only two slashes also split one comment against
 * itself, because the review parser strips `///` and the declaration parser
 * does not, so `/// @evidenceReview` was reported while the `/// @evidence`
 * beside it was not.
 *
 *  1. Write a citation behind three slashes and another behind four.
 *  2. Evaluate the same claim.
 *  3. Assert both are reported.
 */
func TestATagBehindAnyRunOfSlashesIsReported(t *testing.T) {
  messages := runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

/// @evidence docs/spec.md#pricing Three slashes read nothing.
export const other = 2;

//// @evidence docs/spec.md#pricing Four slashes read nothing either.
export const third = 3;
`)
  assertReportedAmong(t, messages, "Unreadable @evidence at src/contracts.ts:4")
  assertReportedAmong(t, messages, "Unreadable @evidence at src/contracts.ts:7")
}

/**
 * Verifies commented-out documentation is not reported.
 *
 * A tag inside a block an author commented out is unreadable, and saying so
 * would be a diagnostic whose repair is wrong for it: the author's move is to
 * delete the block or restore the code it documented, not to put the tag
 * somewhere a claim selects. The shape is recognizable, because the text under
 * the slashes still opens as a documentation block.
 *
 *  1. Comment out a documented declaration whose block carries a citation.
 *  2. Evaluate the same claim.
 *  3. Assert nothing is reported.
 */
func TestCommentedOutDocumentationIsNotReported(t *testing.T) {
  assertNoProblems(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

// /**
//  * Retired.
//  * @evidence docs/spec.md#pricing The old citation.
//  */
// export const old = 3;
`))
}
