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
 * Verifies a citation left behind in commented-out code is reported.
 *
 * A tag in a block an author commented out reaches nothing, exactly like the
 * others, and the first repair tried the opposite: it declined the whole
 * comment on the theory that naming a move would send the author to relocate a
 * tag they should delete. That silence cost more than it saved, because it
 * keyed on a line opening like a block after its slashes came off, so it also
 * swallowed every tag in any comment that happened to contain one such line.
 * The diagnostic names both moves instead.
 *
 *  1. Comment out a documented declaration whose block carries a citation.
 *  2. Evaluate the same claim.
 *  3. Assert the tag is reported.
 */
func TestACitationInCommentedOutCodeIsReported(t *testing.T) {
  assertReported(t, runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

// /**
//  * Retired.
//  * @evidence docs/spec.md#pricing The old citation.
//  */
// export const old = 3;
`), "Unreadable @evidence at src/contracts.ts:6")
}

/**
 * Verifies every tag in one comment is reported, not only the first.
 *
 * A comment is read line by line and each tag in it is its own declaration, so
 * one unreadable line must not decide for the others. The first repair took the
 * whole comment out on the strength of a single line, which silenced tags
 * above and below it in the same block: a regression the shape below is the
 * smallest witness of.
 *
 *  1. Write two citations in one block comment with a slash-prefixed line
 *     between them.
 *  2. Evaluate the same claim.
 *  3. Assert both are reported at their own lines.
 */
func TestEveryTagInOneCommentIsReported(t *testing.T) {
  messages := runUnreadableRule(t, `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;

/*
@evidence docs/spec.md#pricing The first tag in the block.
// * a note somebody pasted in
@evidence docs/spec.md#pricing The second tag in the block.
*/
export const other = 2;
`)
  assertReportedAmong(t, messages, "Unreadable @evidence at src/contracts.ts:5")
  assertReportedAmong(t, messages, "Unreadable @evidence at src/contracts.ts:7")
}

/**
 * Verifies a tag outside every configured population is not reported.
 *
 * A base is a directory and a population is a glob inside it, so a file is
 * scanned whenever it sits under a declared root and belongs to a population
 * only if the glob takes it. Reporting every scanned file made the rule answer
 * for source it does not govern: a stray tag in a consumer's `node_modules`
 * failed their build and named a repair in a file they did not write.
 *
 * The governed file is the negative twin. Confining the report must not silence
 * the population the rule exists for.
 *
 *  1. Write the same unreadable tag inside and outside the claim's glob.
 *  2. Evaluate the claim.
 *  3. Assert only the governed one is reported.
 */
func TestATagOutsideEveryPopulationIsNotReported(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`
  cited := `/** @evidence docs/spec.md#pricing The declaration cites this. */
export const limit = 1;
`
  stray := `// @evidence docs/spec.md#pricing A tag the graph does not govern.
export const other = 2;
`
  for _, outside := range []string{
    "tools/scratch.ts",
    "node_modules/vendor/index.ts",
    "unrelated/legacy.ts",
  } {
    t.Run(outside, func(t *testing.T) {
      assertNoProblems(t, runIndexRule(t, map[string]string{
        "docs/spec.md":     "## Pricing {#pricing}\n",
        "src/contracts.ts": cited,
        outside:            stray,
      }, config))
    })
  }
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/contracts.ts": cited + `
// @evidence docs/spec.md#pricing A tag the graph does govern.
export const other = 2;
`,
  }, config), "Unreadable @evidence at src/contracts.ts:4")
}

/**
 * Verifies a deactivated claim still governs the files it declared.
 *
 * Governance was judged against the configuration as activated, and a claim
 * whose population materializes no unit of its symbol kind is dropped there. A
 * file whose every declaration an author commented out produces no unit, so the
 * claim deactivated and the file it declared fell out of the population, and
 * the citation stranded in that commented-out code went unreported. That is the
 * exact shape the diagnostic's second repair clause exists for, so the question
 * is what the author declared rather than what survived activation.
 *
 *  1. Comment out every declaration of the only file a claim selects.
 *  2. Evaluate the claim, which therefore activates nothing.
 *  3. Assert the stranded citation is still reported.
 */
func TestADeactivatedClaimStillGovernsWhatItDeclared(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/contracts.ts": `// /** @evidence docs/spec.md#pricing The whole file is retired. */
// export const limit = 1;
export {};
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"property",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`), "Unreadable @evidence at src/contracts.ts:1")
}

/**
 * Verifies a package reference governs no file of the project.
 *
 * A package reference reads an installed package from disk, and its globs are
 * written as a consumer thinks of that package, so they resolve against the
 * package root. Matched against a project-relative path instead, `**` claimed
 * every file the project has — `node_modules` included, which is the one the
 * confinement exists to release, and the one a consumer cannot edit.
 *
 *  1. Declare a package reference whose glob would match everything.
 *  2. Write an unreadable tag in a vendored file.
 *  3. Assert it is not reported.
 */
func TestAPackageReferenceGovernsNoProjectFile(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "node_modules/@org/api/package.json": packageManifest,
    "node_modules/@org/api/lib/index.d.ts": `
export declare function get(): void;
`,
    "node_modules/vendor/index.ts": `// @evidence get A tag in a file the consumer did not write.
export const other = 2;
`,
    "src/views/detail.ts": "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["**/*.ts"],"symbol":"function"}
  }]}`), "Missing acknowledgement for 'get'")
}
